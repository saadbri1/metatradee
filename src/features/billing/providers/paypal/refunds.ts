/**
 * Refunds and reversals for one-time PayPal payments.
 *
 * A capture grants a window; a refund has to take back the part of it the buyer
 * has not consumed. The arithmetic itself already exists in access-period.ts
 * (`revokeAccessWindow`) — what lives here is the harder question of WHICH row
 * to change, because stacking means the days a payment bought are not stored on
 * that payment's own row.
 *
 * THE MODEL. Each row's `access_expires_at` is the CUMULATIVE expiry as at that
 * capture, and the user's entitlement is the maximum across their COMPLETED
 * rows. So after two stacked monthly payments:
 *
 *     A  starts T1  expires T1+30
 *     B  starts T2  expires T1+60      ← the live entitlement
 *
 * Refunding A must leave the buyer with 30 days, not 60 — but A's row is not
 * the one holding the 60. Nulling A alone would refund the money and revoke
 * NOTHING. The claw-back therefore has to be applied to whichever row currently
 * holds the furthest expiry, which is why this is not simply "delete the row".
 *
 * TWO CONSTRAINTS FROM THE TABLE shape everything below:
 *   - a non-COMPLETED row may not hold an access window at all, so a refunded
 *     row's window MUST be nulled
 *   - access_expires_at must be strictly greater than access_starts_at, so a
 *     clamped survivor can never be given an expiry at or before its own start
 */
import { revokeAccessWindow } from '../../access-period';
import type { BillingInterval } from '../../pricing';

/** PayPal events that take money back. Nothing else may revoke access. */
export const REFUND_EVENTS = {
  'PAYMENT.CAPTURE.REFUNDED': 'REFUNDED',
  'PAYMENT.CAPTURE.REVERSED': 'REVERSED',
} as const;

export type RefundEventType = keyof typeof REFUND_EVENTS;
export type RefundStatus = (typeof REFUND_EVENTS)[RefundEventType];

export function isRefundEvent(eventType: string): eventType is RefundEventType {
  return eventType in REFUND_EVENTS;
}

/** Which timestamp column the status writes to. */
export function timestampColumnFor(status: RefundStatus): 'refunded_at' | 'reversed_at' {
  return status === 'REFUNDED' ? 'refunded_at' : 'reversed_at';
}

/**
 * A capture id, dug out of the webhook resource.
 *
 * The two events do not agree on where it is. A REVERSED resource IS the
 * capture, so its `id` is what we want. A REFUNDED resource is a REFUND — its
 * `id` is the refund's own id, and the capture is only reachable through the
 * `up` link. Falling back to `resource.id` for a refund would search for a
 * refund id in a capture-id column: it would never match, and the refund would
 * be silently acknowledged while access stayed granted.
 */
export function captureIdFromResource(
  eventType: RefundEventType,
  resource: Record<string, unknown> | null | undefined,
): string | null {
  if (!resource) return null;

  if (eventType === 'PAYMENT.CAPTURE.REVERSED') {
    return typeof resource.id === 'string' && resource.id.length > 0 ? resource.id : null;
  }

  // REFUNDED: follow the `up` link to the capture it reverses.
  const links = Array.isArray(resource.links) ? resource.links : [];
  for (const raw of links) {
    const link = raw as { rel?: unknown; href?: unknown };
    if (link.rel !== 'up' || typeof link.href !== 'string') continue;
    const match = /\/v2\/payments\/captures\/([A-Za-z0-9-]+)/.exec(link.href);
    if (match?.[1]) return match[1];
  }
  return null;
}

/** A row that will remain COMPLETED after the refund is applied. */
export interface SurvivingWindow {
  accessStartsAt: Date;
  accessExpiresAt: Date;
}

export interface RevocationPlan {
  /** What the user's entitlement expiry must become. */
  targetExpiry: Date;
  /**
   * The expiry to write onto the surviving max-holder, or null when no
   * surviving row needs changing (it already ends at or before the target).
   */
  survivorExpiry: Date | null;
}

/**
 * Work out what a refund should leave behind.
 *
 * @param interval       What the REFUNDED payment bought — the size of the
 *                       claw-back, taken from that payment's own row so a
 *                       monthly refund never removes a year.
 * @param currentExpiry  The user's live expiry BEFORE the refund: the maximum
 *                       across all their COMPLETED rows, including the one
 *                       being refunded.
 * @param refundedAt     When PayPal says the money went back.
 * @param survivor       The furthest-out window among the rows that will still
 *                       be COMPLETED afterwards, or null if none remain.
 */
export function planRevocation(
  interval: BillingInterval,
  currentExpiry: Date | null,
  refundedAt: Date,
  survivor: SurvivingWindow | null,
): RevocationPlan {
  // The existing, tested arithmetic. Never produces an expiry before the
  // refund instant, so a claw-back cannot write a past date that would then
  // inflate the NEXT stacking calculation.
  const targetExpiry = revokeAccessWindow(interval, currentExpiry, refundedAt);

  if (!survivor) return { targetExpiry, survivorExpiry: null };

  /*
   * Only ever reduce. If the surviving row already ends at or before the
   * target, the refunded row was the one holding the extra time and nulling it
   * is the whole of the revocation — touching the survivor here would take
   * away access a DIFFERENT successful payment paid for.
   */
  if (survivor.accessExpiresAt.getTime() <= targetExpiry.getTime()) {
    return { targetExpiry, survivorExpiry: null };
  }

  /*
   * The table requires access_expires_at > access_starts_at, and the survivor
   * keeps its own start. If the claw-back reaches past that start the row would
   * be invalid, so it is floored one millisecond above it. That instant is in
   * the past, so the user still resolves to Free — the floor changes what is
   * STORED, never what is granted.
   */
  const floor = survivor.accessStartsAt.getTime() + 1;
  const clamped = Math.max(targetExpiry.getTime(), floor);

  return { targetExpiry, survivorExpiry: new Date(clamped) };
}
