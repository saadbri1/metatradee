'use server';

/**
 * The one-time PayPal Orders flow, server side.
 *
 * TWO actions, and between them the browser is trusted with exactly one value:
 * an order id it received from us in the first place.
 *
 *   createPayPalOrderAction(tier, interval)
 *     The client names a PRODUCT, never a price. The amount, the currency, the
 *     duration and the owner are all derived here — from the central pricing
 *     config and the authenticated session — and sent to PayPal. A tampered
 *     client can ask for Funded/annual; it cannot ask to pay $0.01 for it.
 *
 *   capturePayPalOrderAction(orderId)
 *     Captures, then re-verifies PayPal's own answer against the caller before
 *     anything is granted. The button's success callback proves nothing.
 *
 * Access is granted by INSERTING a row whose provider_capture_id is unique.
 * That single index is what makes a double-clicked confirm, a retried action
 * and a redelivered event all converge on one grant.
 */
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { isPayPalConfigured } from './client';
import {
  ALREADY_CAPTURED,
  PayPalOrderError,
  captureOrder,
  createOrder,
  getOrder,
  ORDER_CURRENCY,
} from './orders';
import {
  REJECTION_MESSAGE,
  buildReferenceId,
  verifyCapture,
  type CaptureRejection,
  type VerifiedCapture,
} from './capture-verify';
// TEMPORARY — remove with diagnostics.ts after the sandbox test.
import { ppDiag, diag } from './diagnostics';
import { computeAccessWindow } from '../../access-period';
import { amountFor, type BillingInterval } from '../../pricing';
import { isValidTier, type PlanTier } from '../../plans';

/** PayPal order ids are 17 uppercase alphanumerics. Anything else is noise. */
const ORDER_ID = /^[A-Z0-9]{10,32}$/;

const PAYABLE: PlanTier[] = ['trader', 'pro', 'funded'];

export interface CreateOrderResult {
  ok: boolean;
  orderId?: string;
  error?: string;
}

export type CaptureOutcome =
  | 'granted'
  | 'already_granted'
  | 'rejected'
  | 'unauthenticated'
  | 'not_configured'
  | 'invalid_order'
  | 'error';

export interface CaptureResult {
  ok: boolean;
  outcome: CaptureOutcome;
  tier?: PlanTier;
  /** ISO. When the purchased access runs out. */
  accessExpiresAt?: string;
  /** Set only when outcome is 'rejected', for a specific message and audit. */
  reason?: CaptureRejection;
  message: string;
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Best-effort audit. A failed audit must never fail a payment. */
async function audit(userId: string, action: string, metadata: Record<string, unknown>) {
  try {
    await createServiceClient().from('billing_audit').insert({
      user_id: userId,
      action,
      metadata,
    });
  } catch {
    /* Never surfaces — the payment record itself is the durable truth. */
  }
}

/**
 * Create an order for a tier + interval.
 *
 * The price is looked up SERVER-SIDE. This is the only place the amount is
 * decided, and it is decided before PayPal ever sees the order, so there is no
 * window in which a client-supplied number could reach the API.
 */
export async function createPayPalOrderAction(
  tier: PlanTier,
  interval: BillingInterval,
): Promise<CreateOrderResult> {
  if (!isPayPalConfigured()) {
    return { ok: false, error: 'PayPal is not configured, so no payment can be started.' };
  }

  const userId = await currentUserId();
  if (!userId) return { ok: false, error: 'You must be signed in to pay.' };

  // Validate the PRODUCT, since that is all the client gets to choose.
  if (!isValidTier(tier) || !PAYABLE.includes(tier)) {
    return { ok: false, error: 'That plan is not for sale.' };
  }
  if (interval !== 'monthly' && interval !== 'annual') {
    return { ok: false, error: 'That billing period is not available.' };
  }

  const amount = amountFor(tier, interval);
  if (!Number.isInteger(amount) || amount <= 0) {
    // A misconfigured price must not become a free order.
    return { ok: false, error: 'That plan is not priced for purchase yet.' };
  }

  try {
    const referenceId = buildReferenceId(tier, interval);
    /*
     * The two ends of the ownership binding, logged as truncated prefixes so a
     * mismatch is diagnosable without putting a full user id in a log. This is
     * the SENDING end; capture.ownership below is the receiving end, and the
     * pair is what proves whether the same session bound and redeemed.
     */
    ppDiag('order.create', {
      callerUserId: diag.userId(userId),
      customIdSent: diag.userId(userId),
      referenceId,
      tier,
      interval,
    });

    const order = await createOrder(amount, referenceId, userId);
    if (!order.id) return { ok: false, error: 'PayPal did not return an order.' };
    await audit(userId, 'paypal_order_created', {
      order_id: order.id,
      tier,
      interval,
      amount,
      currency: ORDER_CURRENCY,
    });
    return { ok: true, orderId: order.id };
  } catch {
    // PayPal's raw error is never surfaced — it can carry account detail.
    return { ok: false, error: 'PayPal could not start this payment. Please try again shortly.' };
  }
}

/**
 * Capture an approved order and grant access.
 *
 * Everything that decides the grant — status, amount, currency, owner, tier,
 * duration — comes from PayPal's capture response re-checked against the
 * authenticated caller. Nothing from the request body but the order id is used.
 */
export async function capturePayPalOrderAction(orderId: string): Promise<CaptureResult> {
  if (!isPayPalConfigured()) {
    return {
      ok: false,
      outcome: 'not_configured',
      message: 'PayPal is not configured, so no payment can be confirmed.',
    };
  }

  const userId = await currentUserId();
  if (!userId) {
    return { ok: false, outcome: 'unauthenticated', message: 'You must be signed in.' };
  }

  if (typeof orderId !== 'string' || !ORDER_ID.test(orderId)) {
    return {
      ok: false,
      outcome: 'invalid_order',
      message: 'That payment reference is not valid.',
    };
  }

  let order;
  try {
    order = await captureOrder(orderId);
  } catch (err) {
    /*
     * ALREADY CAPTURED is the retry path, not a failure: the buyer refreshed,
     * or the action ran twice. Read the order back and continue — the unique
     * capture id below makes the second pass a no-op rather than a second
     * grant.
     */
    if (err instanceof PayPalOrderError && err.issue === ALREADY_CAPTURED) {
      try {
        order = await getOrder(orderId);
      } catch {
        return {
          ok: false,
          outcome: 'error',
          message: 'We could not confirm this payment with PayPal. Please refresh.',
        };
      }
    } else {
      return {
        ok: false,
        outcome: 'error',
        message: 'We could not complete this payment with PayPal. Please try again shortly.',
      };
    }
  }

  /*
   * Both PayPal locations, read for the LOG only — the decision is still made
   * by verifyCapture. Emitting both is what distinguishes "PayPal returned the
   * owner somewhere else" from "the ids genuinely differ".
   */
  const unit = order.purchase_units?.[0];
  const captureDetail = unit?.payments?.captures?.[0];
  ppDiag('capture.ownership', {
    callerUserId: diag.userId(userId),
    customIdOnCapture: diag.userId(captureDetail?.custom_id),
    customIdOnPurchaseUnit: diag.userId(unit?.custom_id),
    referenceId: unit?.reference_id ?? null,
  });

  const verified = verifyCapture(order, userId);
  if (!verified.ok) {
    /*
     * A rejection is audited but writes NO payment row. Recording one would
     * mean binding a payment we just refused to this user's account, and for
     * `not_yours` that is precisely the thing being prevented.
     */
    await audit(userId, 'paypal_capture_rejected', {
      order_id: orderId,
      reason: verified.reason,
      paypal_status: verified.status,
    });
    return {
      ok: false,
      outcome: 'rejected',
      reason: verified.reason,
      message: REJECTION_MESSAGE[verified.reason],
    };
  }

  ppDiag('capture.verified', {
    customIdSource: verified.customIdSource,
    tier: verified.tier,
    interval: verified.interval,
    days: verified.days,
  });

  return grantAccess(verified, orderId);
}

/**
 * Write the verified capture and the access window it produces.
 *
 * Split out so the grant is one readable unit: read the current expiry, stack
 * onto it, insert. The insert is the ONLY thing that grants access anywhere in
 * the app.
 */
async function grantAccess(v: VerifiedCapture, orderId: string): Promise<CaptureResult> {
  const service = createServiceClient();

  /*
   * The expiry to stack onto. Read from the furthest-out COMPLETED row, which
   * is how the window was written in the first place.
   *
   * RACE NOTE: two captures for the same user landing in the same instant
   * would both read this anchor and both stack from it, granting one period
   * instead of two. That is a genuine (very narrow) under-grant, chosen over
   * the alternative: making this read-then-write atomic would require holding
   * a lock across a network call to PayPal. It errs toward granting less, and
   * the payment rows remain a complete record, so it is correctable.
   */
  const { data: latest } = await service
    .from('paypal_payments')
    .select('access_expires_at')
    .eq('user_id', v.userId)
    .eq('payment_status', 'COMPLETED')
    .order('access_expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentExpiry = (latest as { access_expires_at: string | null } | null)?.access_expires_at;
  const window = computeAccessWindow(
    v.interval,
    v.capturedAt,
    currentExpiry ? new Date(currentExpiry) : null,
  );

  const { error } = await service.from('paypal_payments').insert({
    user_id: v.userId,
    provider: 'paypal',
    provider_order_id: v.orderId || orderId,
    provider_capture_id: v.captureId,
    tier: v.tier,
    billing_interval: v.interval,
    amount: v.amount,
    // The table constrains this to uppercase; the app's plan config stores
    // 'usd'. Normalised here so the two conventions cannot collide.
    currency: v.currency.toUpperCase(),
    payment_status: 'COMPLETED',
    paid_at: v.capturedAt.toISOString(),
    access_starts_at: window.accessStartsAt.toISOString(),
    access_expires_at: window.accessExpiresAt.toISOString(),
  });

  if (error) {
    /*
     * 23505 = unique violation on provider_capture_id (or on the one-window-
     * per-order index). This capture was ALREADY applied — by a double-clicked
     * confirm, a retry, or a concurrent request. It is a success, not an
     * error: report the access already on file rather than granting again.
     */
    if (error.code === '23505') {
      const { data: existing } = await service
        .from('paypal_payments')
        .select('tier, access_expires_at')
        .eq('provider_capture_id', v.captureId)
        .maybeSingle();
      const row = existing as { tier: string; access_expires_at: string } | null;
      return {
        ok: true,
        outcome: 'already_granted',
        tier: (row?.tier as PlanTier) ?? v.tier,
        accessExpiresAt: row?.access_expires_at ?? window.accessExpiresAt.toISOString(),
        message: 'This payment has already been applied to your account.',
      };
    }
    /*
     * The money moved but we could not record it. Never claim access — say so
     * plainly, and leave an audit row so it can be reconciled by hand.
     */
    await audit(v.userId, 'paypal_capture_write_failed', {
      order_id: orderId,
      capture_id: v.captureId,
      db_error: error.code ?? 'unknown',
    });
    return {
      ok: false,
      outcome: 'error',
      message:
        'Your payment went through but we could not record it. Please contact support — your payment reference is ' +
        orderId +
        '.',
    };
  }

  await audit(v.userId, 'paypal_capture_granted', {
    order_id: orderId,
    capture_id: v.captureId,
    tier: v.tier,
    interval: v.interval,
    amount: v.amount,
    days: v.days,
    access_expires_at: window.accessExpiresAt.toISOString(),
  });

  return {
    ok: true,
    outcome: 'granted',
    tier: v.tier,
    accessExpiresAt: window.accessExpiresAt.toISOString(),
    message: `Payment received. You have ${v.days} days of ${v.tier} access.`,
  };
}
