/**
 * Access-period arithmetic for one-time PayPal payments.
 *
 * With Subscriptions, PayPal owned the answer to "does this user still have
 * access" and we mirrored its status. With one-time payments nobody tells us
 * access ended — a capture succeeds once and then time passes. So expiry
 * becomes OUR computation, and this module is the whole of it.
 *
 * PURE by design: no clock of its own, no database, no network. `now` and
 * `capturedAt` are always passed in, so every rule below is directly testable
 * and cannot drift with the machine's timezone.
 *
 * The policy it encodes, exactly as specified:
 *   - monthly grants 30 days, yearly grants 365
 *   - NO grace period; access ends exactly at accessExpiresAt
 *   - paying before expiry extends from the existing expiry (stacking)
 *   - paying after expiry starts a fresh period at the capture time
 *   - only a COMPLETED capture grants anything
 *   - a refund or reversal removes the unconsumed remainder
 */
import type { BillingInterval } from './pricing';

/** Days granted per interval. The only place these numbers exist. */
export const DAYS_FOR_INTERVAL: Record<BillingInterval, number> = {
  monthly: 30,
  annual: 365,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * PayPal capture statuses. Only COMPLETED may grant access — everything else,
 * including PENDING, must grant nothing.
 */
export type CaptureStatus =
  'COMPLETED' | 'PENDING' | 'DECLINED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'REVERSED';

/** The single status that is allowed to move the access window forward. */
export function grantsAccess(status: string): status is 'COMPLETED' {
  return status === 'COMPLETED';
}

/** Statuses that must take previously granted access away. */
export function revokesAccess(status: string): boolean {
  return status === 'REFUNDED' || status === 'REVERSED' || status === 'PARTIALLY_REFUNDED';
}

export interface AccessWindow {
  accessStartsAt: Date;
  accessExpiresAt: Date;
}

/**
 * Compute the window a verified capture produces.
 *
 * @param interval        Derived SERVER-SIDE from the PayPal order mapping —
 *                        never from the browser.
 * @param capturedAt      When PayPal reports the capture completed.
 * @param currentExpiresAt The user's existing expiry, or null if they have none.
 *
 * Stacking rule: if the existing expiry is still in the future, the new period
 * is added to it, so paying early never costs the buyer the days they already
 * hold. If it has passed, the new period starts at the capture — expired time
 * is not retroactively credited.
 */
export function computeAccessWindow(
  interval: BillingInterval,
  capturedAt: Date,
  currentExpiresAt: Date | null,
): AccessWindow {
  const days = DAYS_FOR_INTERVAL[interval];
  const stillValid = currentExpiresAt !== null && currentExpiresAt.getTime() > capturedAt.getTime();

  // Extend from the existing expiry, or start fresh at the capture.
  const anchor = stillValid ? (currentExpiresAt as Date) : capturedAt;

  return {
    // The period the buyer is entitled to begins now either way; only the END
    // stacks. Recording the capture time as the start keeps the audit honest.
    accessStartsAt: capturedAt,
    accessExpiresAt: new Date(anchor.getTime() + days * DAY_MS),
  };
}

/**
 * Does the user have access right now?
 *
 * Exactly at accessExpiresAt the answer is NO — there is no grace period, and
 * `>` rather than `>=` is what makes the boundary exact.
 */
export function hasAccess(accessExpiresAt: Date | null, now: Date): boolean {
  if (!accessExpiresAt) return false;
  return accessExpiresAt.getTime() > now.getTime();
}

/**
 * Remove the access a refunded or reversed capture had granted.
 *
 * Subtracts exactly the days that capture bought. If that lands in the past the
 * user simply has no access from now on — we never produce an expiry earlier
 * than the moment of the refund, because "negative access" is meaningless and
 * would corrupt a later stacking calculation.
 *
 * Time already consumed before the refund is not clawed back further than the
 * remaining balance: subtracting the granted days is the safe, symmetric
 * inverse of having granted them.
 */
export function revokeAccessWindow(
  interval: BillingInterval,
  accessExpiresAt: Date | null,
  refundedAt: Date,
): Date {
  if (!accessExpiresAt) return refundedAt;
  const days = DAYS_FOR_INTERVAL[interval];
  const reduced = new Date(accessExpiresAt.getTime() - days * DAY_MS);
  // Never earlier than the refund itself.
  return reduced.getTime() < refundedAt.getTime() ? refundedAt : reduced;
}

/** Whole days of access remaining, floored at 0. For display only. */
export function daysRemaining(accessExpiresAt: Date | null, now: Date): number {
  if (!hasAccess(accessExpiresAt, now)) return 0;
  const ms = (accessExpiresAt as Date).getTime() - now.getTime();
  return Math.floor(ms / DAY_MS);
}
