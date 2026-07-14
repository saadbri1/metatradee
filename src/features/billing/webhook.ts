/**
 * Webhook interpretation + idempotent application.
 *
 * `interpretEvent` is PURE (unit-tested): it maps a normalized provider event to
 * a mirror update, deriving tier from the price→tier config (or subscription
 * metadata), never computing money. `applyBillingEvent` enforces the money-safety
 * invariants at persistence time:
 *   - IDEMPOTENT: every event id is recorded once (unique). A duplicate/replayed
 *     event is a no-op — a plan is never granted twice, a payment never
 *     double-counted.
 *   - OUT-OF-ORDER SAFE: an event older than the last applied one for a
 *     subscription is ignored (mirror only moves forward).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidTier, type PlanTier } from './plans';
import type { BillingEvent, Invoice, MirroredSubscription, SubscriptionStatus } from './types';

/** Configurable price→tier map (from env/config; empty falls back to metadata). */
export type PriceTierMap = Record<string, PlanTier>;

function toIso(unix: unknown): string | null {
  return typeof unix === 'number' ? new Date(unix * 1000).toISOString() : null;
}

function tierFrom(data: Record<string, unknown>, priceMap: PriceTierMap): PlanTier | null {
  const metaTier = (data.metadata as Record<string, unknown> | undefined)?.tier;
  if (typeof metaTier === 'string' && isValidTier(metaTier)) return metaTier;
  const items = (data.items as { data?: { price?: { id?: string } }[] } | undefined)?.data;
  const priceId = items?.[0]?.price?.id ?? (data.price as { id?: string } | undefined)?.id;
  if (priceId && priceMap[priceId]) return priceMap[priceId];
  return null;
}

export interface MirrorUpdate {
  kind: 'subscription' | 'invoice' | 'ignore';
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  subscription?: MirroredSubscription;
  invoice?: Invoice;
}

const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

/** Pure mapping from a normalized event to a mirror update. */
export function interpretEvent(event: BillingEvent, priceMap: PriceTierMap = {}): MirrorUpdate {
  const d = event.data;
  const customerId = (d.customer as string | undefined) ?? null;

  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    const tier = tierFrom(d, priceMap);
    const status =
      event.type === 'customer.subscription.deleted'
        ? 'canceled'
        : ((d.status as SubscriptionStatus) ?? 'incomplete');
    if (!tier)
      return { kind: 'ignore', providerCustomerId: customerId, providerSubscriptionId: null };
    return {
      kind: 'subscription',
      providerCustomerId: customerId,
      providerSubscriptionId: (d.id as string | undefined) ?? null,
      subscription: {
        tier,
        status,
        currentPeriodEnd: toIso(d.current_period_end),
        cancelAtPeriodEnd: d.cancel_at_period_end === true,
        trialEnd: toIso(d.trial_end),
      },
    };
  }

  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
    return {
      kind: 'invoice',
      providerCustomerId: customerId,
      providerSubscriptionId: (d.subscription as string | undefined) ?? null,
      invoice: {
        providerInvoiceId: (d.id as string | undefined) ?? '',
        number: (d.number as string | undefined) ?? null,
        amountDue: (d.amount_due as number | undefined) ?? 0,
        amountPaid: (d.amount_paid as number | undefined) ?? 0,
        currency: (d.currency as string | undefined) ?? 'usd',
        status: (d.status as string | undefined) ?? 'open',
        periodStart: toIso((d.period_start as number | undefined) ?? undefined),
        periodEnd: toIso((d.period_end as number | undefined) ?? undefined),
        hostedInvoiceUrl: (d.hosted_invoice_url as string | undefined) ?? null,
        pdfUrl: (d.invoice_pdf as string | undefined) ?? null,
        createdAt: toIso(event.createdAt) ?? new Date().toISOString(),
      },
    };
  }

  return { kind: 'ignore', providerCustomerId: customerId, providerSubscriptionId: null };
}

export interface ApplyResult {
  applied: boolean;
  duplicate: boolean;
  reason?: string;
}

/**
 * Idempotently apply a verified event. Records the event id first (unique); on
 * conflict it is a duplicate/replay and nothing is applied.
 */
export async function applyBillingEvent(
  supabase: SupabaseClient,
  event: BillingEvent,
  priceMap: PriceTierMap = {},
): Promise<ApplyResult> {
  // 1. Idempotency gate: first writer wins; a duplicate insert fails the unique.
  const { error: dedupeError } = await supabase.from('billing_events').insert({
    event_id: event.id,
    type: event.type,
    created_at_provider: event.createdAt,
    payload: event.data,
  });
  if (dedupeError) {
    // Unique violation → already processed. Any other error is surfaced.
    if (dedupeError.code === '23505') return { applied: false, duplicate: true };
    return { applied: false, duplicate: false, reason: dedupeError.message };
  }

  const update = interpretEvent(event, priceMap);
  if (update.kind === 'ignore' || !update.providerCustomerId) {
    return { applied: false, duplicate: false, reason: 'no-op event' };
  }

  // Map provider customer → our user (owner-scoped mirror).
  const { data: customer } = await supabase
    .from('billing_customers')
    .select('user_id')
    .eq('provider_customer_id', update.providerCustomerId)
    .maybeSingle();
  const userId = (customer as { user_id: string } | null)?.user_id;
  if (!userId) return { applied: false, duplicate: false, reason: 'unknown customer' };

  if (update.kind === 'subscription' && update.subscription) {
    const s = update.subscription;
    // Out-of-order guard: only move the mirror forward.
    const { data: existing } = await supabase
      .from('billing_subscriptions')
      .select('last_event_at')
      .eq('user_id', userId)
      .maybeSingle();
    const lastAt = (existing as { last_event_at: number | null } | null)?.last_event_at ?? 0;
    if (event.createdAt < lastAt)
      return { applied: false, duplicate: false, reason: 'stale event' };

    await supabase.from('billing_subscriptions').upsert(
      {
        user_id: userId,
        provider_subscription_id: update.providerSubscriptionId,
        tier: s.tier,
        status: s.status,
        current_period_end: s.currentPeriodEnd,
        cancel_at_period_end: s.cancelAtPeriodEnd,
        trial_end: s.trialEnd,
        last_event_at: event.createdAt,
      },
      { onConflict: 'user_id' },
    );
  } else if (update.kind === 'invoice' && update.invoice) {
    const inv = update.invoice;
    await supabase.from('billing_invoices').upsert(
      {
        user_id: userId,
        provider_invoice_id: inv.providerInvoiceId,
        number: inv.number,
        amount_due: inv.amountDue,
        amount_paid: inv.amountPaid,
        currency: inv.currency,
        status: inv.status,
        period_start: inv.periodStart,
        period_end: inv.periodEnd,
        hosted_invoice_url: inv.hostedInvoiceUrl,
        pdf_url: inv.pdfUrl,
      },
      { onConflict: 'provider_invoice_id' },
    );
  }

  return { applied: true, duplicate: false };
}
