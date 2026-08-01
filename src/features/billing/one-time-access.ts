/**
 * Entitlement resolution for one-time payments — PURE.
 *
 * With subscriptions, a provider status ('active', 'past_due', …) answered
 * "does this user have access". With one-time payments there is no status to
 * read: there is a date, and the answer is whether it has passed. So the whole
 * of entitlement here is `now < access_expires_at`.
 *
 * That makes EXPIRY the default outcome rather than an event we must be told
 * about. Nobody sends a webhook when access runs out — it simply does, and the
 * next read resolves to Free with no code having run in between. This is
 * strictly safer than the mirrored-status model it replaces, where a missed
 * webhook left a paid tier granted indefinitely.
 *
 * There is no grace period and no renewal. `hasAccess` uses a strict `>`, so at
 * the exact expiry instant the user is already on Free.
 */
import { PLANS, type PlanTier } from './plans';
import { hasAccess } from './access-period';
import { FREE } from './entitlements';
import type { Entitlement } from './types';

/** The one-time access a user currently holds, as read from paypal_payments. */
export interface OneTimeAccess {
  tier: PlanTier;
  /** ISO timestamp. The entitlement authority. */
  accessExpiresAt: string;
}

/**
 * Resolve capabilities from a paid access window.
 *
 * Returns FREE — never null — for every ambiguous case: no access on file, an
 * unparseable date, an unknown tier, or an expiry that has passed. Fail-closed
 * is the same invariant the subscription resolver holds, and it is why an
 * error in this path costs a paying user their features rather than giving a
 * non-paying one someone else's.
 */
export function resolveOneTimeEntitlement(
  access: OneTimeAccess | null | undefined,
  now: Date = new Date(),
): Entitlement {
  if (!access || !PLANS[access.tier]) return FREE;

  const expiresAt = new Date(access.accessExpiresAt);
  if (Number.isNaN(expiresAt.getTime())) return FREE;

  // Expired → Free. No provider call, no webhook, no grace.
  if (!hasAccess(expiresAt, now)) return FREE;

  const plan = PLANS[access.tier];
  return {
    tier: access.tier,
    features: plan.features,
    limits: plan.limits,
    status: 'active',
    // Dunning does not exist for a payment that already succeeded.
    inGracePeriod: false,
    /*
     * Always set, unlike the subscription model where `endingAt` meant "this
     * was cancelled". One-time access is ALWAYS ending — the UI should say so
     * rather than imply the plan continues.
     */
    endingAt: expiresAt.toISOString(),
  };
}

/** True when the user holds paid one-time access right now. */
export function hasOneTimeAccess(
  access: OneTimeAccess | null | undefined,
  now: Date = new Date(),
): boolean {
  return resolveOneTimeEntitlement(access, now).tier !== 'free';
}
