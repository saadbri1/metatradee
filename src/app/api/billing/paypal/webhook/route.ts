/**
 * PayPal webhook. PayPal POSTs here with no user session.
 *
 * Handles two families of event. Refunds and reversals of ONE-TIME Orders
 * captures are the live path and are dispatched first. The Subscriptions
 * branch below it is legacy: that checkout has been deleted, so no new
 * subscriptions can be created, and it remains only to mirror events for
 * accounts that still hold one.
 *
 *   1. Size-cap BEFORE any work, so an oversized body costs nothing.
 *   2. Read the RAW body — the signature is over exact bytes, never re-parse
 *      then re-serialise.
 *   3. Verify with PayPal (fails closed: no webhook id, missing header, or any
 *      non-SUCCESS answer is a rejection).
 *   4. Record the event id first — a replay hits the unique index and no-ops.
 *   5. Only then update the mirror, and only ever forward in time.
 *
 * Nothing here trusts the request body for authority beyond what the signature
 * covers, and no secret is ever logged or returned.
 */
import { NextResponse } from 'next/server';
import {
  isPayPalConfigured,
  missingPayPalEnvKeys,
  payPalConfig,
  verifyWebhookSignature,
  webhookHeadersFrom,
} from '@/features/billing/providers/paypal/client';
import { bindingForPaypalPlanId } from '@/features/billing/providers/paypal/plan-map';
import {
  interpretPayPalEvent,
  type PayPalResource,
} from '@/features/billing/providers/paypal/interpret';
import { applyRefund } from '@/features/billing/providers/paypal/apply-refund';
import {
  REFUND_EVENTS,
  captureIdFromResource,
  isRefundEvent,
} from '@/features/billing/providers/paypal/refunds';
import { createServiceClient } from '@/lib/supabase/service';
import { isWebhookBodyTooLarge } from '@/features/billing/webhook-limits';
// TEMPORARY — remove with diagnostics.ts after the sandbox test.
import { ppDiag, diag } from '@/features/billing/providers/paypal/diagnostics';

// Buffer + crypto are needed for Basic auth encoding; the Edge runtime is not.
export const runtime = 'nodejs';
// A webhook must never be served from a cache.
export const dynamic = 'force-dynamic';

interface PayPalWebhookEvent {
  id?: string;
  event_type?: string;
  create_time?: string;
  resource?: PayPalResource;
}

/** Seconds since epoch, used for the forward-only ordering guard. */
function eventTimestamp(event: PayPalWebhookEvent): number {
  const t = event.create_time ? Date.parse(event.create_time) : NaN;
  return Number.isNaN(t) ? Math.floor(Date.now() / 1000) : Math.floor(t / 1000);
}

export async function POST(req: Request): Promise<NextResponse> {
  // 1. Size cap first — declared header, then actual bytes below.
  if (isWebhookBodyTooLarge(req.headers.get('content-length'))) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  // 2. Raw body. Signature verification is over these exact bytes.
  const rawBody = await req.text();
  if (isWebhookBodyTooLarge(String(Buffer.byteLength(rawBody)))) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  /*
   * Fail closed on configuration. 503 (not 200) is deliberate: PayPal retries
   * 5xx, so events that arrive before PAYPAL_WEBHOOK_ID is set are redelivered
   * once it is, rather than being silently swallowed. Only NAMES are returned,
   * never values.
   */
  if (!isPayPalConfigured()) {
    return NextResponse.json(
      { error: 'paypal_not_configured', missing: missingPayPalEnvKeys() },
      { status: 503 },
    );
  }

  const cfg = payPalConfig();

  // 3. Verify. Anything short of an explicit SUCCESS is a rejection.
  const verified = await verifyWebhookSignature(rawBody, webhookHeadersFrom(req.headers), cfg);
  if (!verified) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PayPalWebhookEvent;
  } catch {
    return NextResponse.json({ error: 'malformed_event' }, { status: 400 });
  }
  if (!event.id || !event.event_type) {
    return NextResponse.json({ error: 'malformed_event' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const createdAt = eventTimestamp(event);

  // Event TYPE only — never the payload, which carries buyer detail.
  ppDiag('webhook.received', {
    eventType: event.event_type,
    eventId: diag.subscriptionId(event.id),
    subscription: diag.subscriptionId(event.resource?.id ?? null),
    paypalStatus: event.resource?.status ?? null,
  });

  /*
   * 4. Idempotency gate — first writer wins. A redelivered event violates the
   * primary key and is acknowledged 200 so PayPal stops retrying, but nothing
   * is applied twice.
   */
  const { error: dedupeError } = await supabase.from('billing_events').insert({
    event_id: event.id,
    type: event.event_type,
    created_at_provider: createdAt,
    payload: (event.resource ?? {}) as Record<string, unknown>,
  });
  if (dedupeError) {
    if (dedupeError.code === '23505') {
      ppDiag('webhook.applied', {
        eventType: event.event_type,
        applied: false,
        reason: 'duplicate',
      });
      return NextResponse.json({ received: true, duplicate: true });
    }
    // Do not echo the database message to PayPal.
    return NextResponse.json({ error: 'storage_error' }, { status: 500 });
  }

  /*
   * 5. REFUNDS AND REVERSALS — the one-time Orders path.
   *
   * Dispatched before the subscription interpreter, which would classify these
   * as 'ignore' and acknowledge them without revoking anything. Runs AFTER the
   * signature check and AFTER the event-id dedupe gate, so an unsigned or
   * replayed refund can never reach it.
   */
  if (isRefundEvent(event.event_type)) {
    const captureId = captureIdFromResource(
      event.event_type,
      event.resource as unknown as Record<string, unknown>,
    );
    if (!captureId) {
      // Nothing to address. Acknowledged so PayPal stops retrying.
      ppDiag('webhook.applied', {
        eventType: event.event_type,
        applied: false,
        reason: 'no_capture_id',
      });
      return NextResponse.json({ received: true, applied: false, reason: 'no_capture_id' });
    }

    const occurredAt = event.create_time ? new Date(event.create_time) : new Date();
    const result = await applyRefund(
      supabase,
      captureId,
      REFUND_EVENTS[event.event_type],
      Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
    );

    ppDiag('webhook.refund', {
      eventType: event.event_type,
      capture: diag.subscriptionId(captureId),
      outcome: result.outcome,
    });

    /*
     * Only a storage failure is a 5xx. Every other outcome — unknown capture,
     * already refunded — is final, and asking PayPal to retry it would just
     * redeliver an event that can never change anything.
     */
    if (result.outcome === 'storage_error') {
      return NextResponse.json({ error: 'storage_error' }, { status: 500 });
    }
    return NextResponse.json({
      received: true,
      applied: result.outcome === 'applied',
      reason: result.outcome,
    });
  }

  const interpreted = interpretPayPalEvent(event.event_type, event.resource ?? {}, {
    resolvePlan: (planId) => {
      const binding = bindingForPaypalPlanId(planId);
      return binding ? { tier: binding.tier, interval: binding.interval } : null;
    },
  });

  if (interpreted.kind === 'ignore' || !interpreted.subscription || !interpreted.userId) {
    // Acknowledged and recorded, but no authority change.
    ppDiag('webhook.applied', {
      eventType: event.event_type,
      applied: false,
      reason: interpreted.reason ?? 'ignored',
      unknownPlanId: interpreted.unknownPlanId === true,
    });
    return NextResponse.json({ received: true, applied: false, reason: interpreted.reason });
  }

  /*
   * 6. Forward-only guard. A late-arriving older event must never overwrite a
   * newer state — otherwise a delayed CREATED could undo an ACTIVATED.
   */
  const { data: existing } = await supabase
    .from('billing_subscriptions')
    .select('last_event_at')
    .eq('user_id', interpreted.userId)
    .maybeSingle();
  const lastAt = (existing as { last_event_at: number | null } | null)?.last_event_at ?? 0;
  if (createdAt < lastAt) {
    ppDiag('webhook.applied', {
      eventType: event.event_type,
      applied: false,
      reason: 'stale_event',
    });
    return NextResponse.json({ received: true, applied: false, reason: 'stale_event' });
  }

  const sub = interpreted.subscription;
  const { error: upsertError } = await supabase.from('billing_subscriptions').upsert(
    {
      user_id: interpreted.userId,
      provider_subscription_id: interpreted.paypalSubscriptionId,
      tier: sub.tier,
      status: sub.status,
      current_period_end: sub.currentPeriodEnd,
      cancel_at_period_end: sub.cancelAtPeriodEnd,
      trial_end: sub.trialEnd,
      last_event_at: createdAt,
    },
    { onConflict: 'user_id' },
  );
  if (upsertError) {
    return NextResponse.json({ error: 'storage_error' }, { status: 500 });
  }

  ppDiag('webhook.applied', {
    eventType: event.event_type,
    applied: true,
    reason: 'mirrored',
    subscription: diag.subscriptionId(interpreted.paypalSubscriptionId),
    mirroredStatus: sub.status,
    resultingTier: sub.tier,
    unknownPlanId: interpreted.unknownPlanId === true,
  });

  return NextResponse.json({
    received: true,
    applied: true,
    // Useful for PayPal's dashboard delivery log; contains no secrets.
    unknownPlanId: interpreted.unknownPlanId === true,
  });
}

/**
 * PayPal only ever POSTs. A GET is answered so the URL can be reached in a
 * browser to confirm the route is deployed, without revealing configuration.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ endpoint: 'paypal-webhook', method: 'POST' }, { status: 405 });
}
