/**
 * Entitlement resolution + server-side limit enforcement. THE authoritative
 * capability source. Two invariants:
 *  1. FAIL CLOSED — unknown/absent/errored subscription state resolves to the
 *     Free plan (least privilege). Paid access is granted only on an explicitly
 *     access-granting mirrored status.
 *  2. Access continues to period end — a canceled/at-period-end subscription
 *     keeps its tier until currentPeriodEnd; past_due keeps it during the grace
 *     window (dunning). Data is never deleted on downgrade.
 * The client receives the resolved Entitlement as read-only flags; it reflects
 * access but never decides it.
 */
import { PLANS, type PlanTier } from './plans';
import type { Entitlement, MirroredSubscription } from './types';

const FREE_ENTITLEMENT: Entitlement = {
  tier: 'free',
  features: PLANS.free.features,
  limits: PLANS.free.limits,
  status: 'none',
  inGracePeriod: false,
  endingAt: null,
};

function entitlementFor(
  tier: PlanTier,
  status: Entitlement['status'],
  inGracePeriod: boolean,
  endingAt: string | null,
): Entitlement {
  const plan = PLANS[tier];
  return { tier, features: plan.features, limits: plan.limits, status, inGracePeriod, endingAt };
}

/**
 * Resolve capabilities from a mirrored subscription (or null). Pure + total —
 * it never throws; any ambiguity collapses to Free.
 */
export function resolveEntitlement(
  sub: MirroredSubscription | null | undefined,
  now: Date = new Date(),
): Entitlement {
  if (!sub || !PLANS[sub.tier]) return FREE_ENTITLEMENT;

  const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : null;
  const stillInPeriod = periodEnd !== null && periodEnd > now.getTime();

  switch (sub.status) {
    case 'active':
    case 'trialing':
      return entitlementFor(
        sub.tier,
        sub.status,
        false,
        sub.cancelAtPeriodEnd ? sub.currentPeriodEnd : null,
      );
    case 'past_due':
      // Dunning grace: keep access while the provider retries, but flag it.
      return entitlementFor(sub.tier, 'past_due', true, sub.currentPeriodEnd);
    case 'canceled':
      // Access continues until the paid period actually ends, then → Free.
      return stillInPeriod
        ? entitlementFor(sub.tier, 'canceled', false, sub.currentPeriodEnd)
        : FREE_ENTITLEMENT;
    default:
      // incomplete / unpaid / expired / unknown → fail closed.
      return FREE_ENTITLEMENT;
  }
}

export function hasFeature(ent: Entitlement, feature: keyof Entitlement['features']): boolean {
  return ent.features[feature] === true;
}

export interface LimitCheck {
  allowed: boolean;
  limit: number | null;
  current: number;
  /** Upsell copy naming the exact gated value (for the paywall). */
  reason: string | null;
}

/**
 * Server-side numeric limit enforcement. `current` is the existing count; the
 * check answers "may the user add one more?". `null` limit = unlimited.
 */
export function checkLimit(
  ent: Entitlement,
  key: keyof Entitlement['limits'],
  current: number,
): LimitCheck {
  const limit = ent.limits[key];
  if (limit === null) return { allowed: true, limit: null, current, reason: null };
  const allowed = current < limit;
  return {
    allowed,
    limit,
    current,
    reason: allowed
      ? null
      : `You've reached the ${ent.tier} plan limit of ${limit}. Upgrade to add more.`,
  };
}

/** The free default, exported for fail-closed call sites. */
export const FREE = FREE_ENTITLEMENT;
