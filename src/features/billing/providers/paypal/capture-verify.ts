/**
 * Capture verification — PURE.
 *
 * This is the gate every one-time payment passes through, and it deliberately
 * has no network, no database and no clock of its own. Everything it decides is
 * a function of (what PayPal returned, who is asking), so every rejection below
 * is directly testable without a sandbox.
 *
 * What it refuses, and why each one matters:
 *
 *   - anything but a COMPLETED capture — PENDING is not money, and treating it
 *     as money is how a buyer gets access for a payment that later fails
 *   - an amount that is not exactly our configured price for that tier and
 *     interval — the browser picks a tier, never a price, and this is where
 *     that guarantee is enforced against PayPal's own copy of the order
 *   - a currency that is not the one we priced in — 19.00 of something else is
 *     not 19.00 USD
 *   - a payment whose custom_id is not the caller — otherwise one user could
 *     redeem another's capture
 *   - a reference_id that does not name a tier and interval we sell
 *
 * Note the ordering is irrelevant to safety: every check must pass, and the
 * first failure is reported so the caller can log a specific reason rather
 * than a generic "declined".
 */
import { amountFor, type BillingInterval } from '../../pricing';
import { isValidTier, type PlanTier } from '../../plans';
import { DAYS_FOR_INTERVAL, grantsAccess } from '../../access-period';
import { ORDER_CURRENCY, parseAmount, type PayPalOrder } from './orders';

/** Tiers that can actually be bought. Free is never a payment. */
const PAYABLE: PlanTier[] = ['trader', 'pro', 'funded'];

export type CaptureRejection =
  | 'no_capture'
  | 'not_completed'
  | 'unknown_reference'
  | 'wrong_currency'
  | 'wrong_amount'
  | 'not_yours';

export interface VerifiedCapture {
  ok: true;
  captureId: string;
  orderId: string;
  userId: string;
  tier: PlanTier;
  interval: BillingInterval;
  /** Cents, re-derived from OUR pricing config — not read from PayPal. */
  amount: number;
  currency: typeof ORDER_CURRENCY;
  /** Days this purchase buys. Derived server-side from the interval. */
  days: number;
  capturedAt: Date;
  /**
   * Which of the two PayPal locations the owner was found in. Diagnostic only
   * — it never affects the decision — but it is what distinguishes "PayPal
   * moved the field" from "the ids genuinely differ" when this path misbehaves.
   */
  customIdSource: 'capture' | 'purchase_unit';
}

export interface RejectedCapture {
  ok: false;
  reason: CaptureRejection;
  /** PayPal's capture status when there was one, for the audit trail. */
  status: string | null;
}

export type CaptureVerification = VerifiedCapture | RejectedCapture;

/** `tier:interval` — the only thing reference_id is ever allowed to be. */
export function buildReferenceId(tier: PlanTier, interval: BillingInterval): string {
  return `${tier}:${interval}`;
}

export function parseReferenceId(
  reference: string | undefined | null,
): { tier: PlanTier; interval: BillingInterval } | null {
  if (!reference) return null;
  const [tier, interval] = reference.split(':');
  if (!tier || !isValidTier(tier) || !PAYABLE.includes(tier)) return null;
  if (interval !== 'monthly' && interval !== 'annual') return null;
  return { tier, interval };
}

/**
 * Grade a capture response against the caller.
 *
 * @param order      Exactly what PayPal's capture (or order read) returned.
 * @param callerId   The AUTHENTICATED user id. Never a value from the request
 *                   body — the whole point of this check is that the payment's
 *                   owner and the person redeeming it are the same account.
 */
export function verifyCapture(order: PayPalOrder, callerId: string): CaptureVerification {
  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  const status = capture?.status ?? order.status ?? null;

  if (!capture || !capture.id) return { ok: false, reason: 'no_capture', status };

  /*
   * ONLY COMPLETED. Checked against the capture, not the order: an order can
   * read COMPLETED while the capture underneath it is PENDING (a held payment),
   * and it is the capture that says whether the money is ours.
   */
  if (!grantsAccess(capture.status ?? '')) {
    return { ok: false, reason: 'not_completed', status };
  }

  // What was bought is read from PayPal's echo of what we asked for.
  const parsed = parseReferenceId(unit?.reference_id);
  if (!parsed) return { ok: false, reason: 'unknown_reference', status };

  const currency = capture.amount?.currency_code ?? unit?.amount?.currency_code ?? null;
  if (currency !== ORDER_CURRENCY) return { ok: false, reason: 'wrong_currency', status };

  /*
   * The price is re-derived from the central pricing config and compared to
   * what PayPal says was actually captured. A tampered order that approved
   * $0.01 for Funded fails HERE, after the money moved — which is why the
   * caller must refuse the grant rather than reconcile it.
   */
  const expected = amountFor(parsed.tier, parsed.interval);
  const captured = parseAmount(capture.amount?.value ?? '');
  if (captured === null || captured !== expected) {
    return { ok: false, reason: 'wrong_amount', status };
  }

  /*
   * OWNERSHIP. custom_id was set server-side at creation.
   *
   * It is read from the CAPTURE first and the purchase unit second, because
   * the two PayPal responses put it in different places:
   *
   *   GET    /v2/checkout/orders/{id}          → purchase_units[0].custom_id
   *   POST   /v2/checkout/orders/{id}/capture  → purchase_units[0]
   *                                                .payments.captures[0].custom_id
   *
   * The capture response returns a TRIMMED purchase unit — reference_id
   * survives on it, custom_id does not — so reading only `unit.custom_id`
   * found `undefined` on every real capture and refused the buyer their own
   * payment. Both locations are consulted so the same verifier grades a
   * capture response and an order read identically.
   *
   * This is NOT a relaxation. A custom_id absent from both places is still a
   * rejection, and the comparison is still exact equality against the
   * authenticated caller — an order with no owner, or someone else's owner,
   * grants nothing.
   */
  const customId = capture.custom_id ?? unit?.custom_id ?? null;
  if (!customId || customId !== callerId) {
    return { ok: false, reason: 'not_yours', status };
  }

  /*
   * The capture time comes from PayPal, so the access window is anchored to
   * when the money actually moved rather than when our server got around to
   * processing it. An unparseable timestamp is not silently replaced with
   * "now" — that would let a delayed capture quietly buy extra days — but a
   * missing one is genuinely absent from some sandbox responses, so it falls
   * back to update_time before giving up.
   */
  const rawTime = capture.create_time ?? capture.update_time ?? null;
  const capturedAt = rawTime ? new Date(rawTime) : null;
  if (!capturedAt || Number.isNaN(capturedAt.getTime())) {
    return { ok: false, reason: 'no_capture', status };
  }

  return {
    ok: true,
    captureId: capture.id,
    orderId: order.id ?? '',
    userId: callerId,
    tier: parsed.tier,
    interval: parsed.interval,
    amount: expected,
    currency: ORDER_CURRENCY,
    days: DAYS_FOR_INTERVAL[parsed.interval],
    capturedAt,
    customIdSource: capture.custom_id ? 'capture' : 'purchase_unit',
  };
}

/** Human-readable, non-leaking copy for each rejection. */
export const REJECTION_MESSAGE: Record<CaptureRejection, string> = {
  no_capture: 'PayPal did not report a completed payment. Nothing has been charged.',
  not_completed:
    'PayPal has your approval but the payment has not completed yet. Your access will not start until it does.',
  unknown_reference: 'That payment does not correspond to a plan we sell.',
  wrong_currency: 'That payment was not made in the currency this plan is priced in.',
  wrong_amount: 'The amount paid does not match the price of the plan selected.',
  not_yours: 'That payment does not belong to this account.',
};
