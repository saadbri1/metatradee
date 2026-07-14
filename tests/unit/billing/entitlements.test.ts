import { describe, it, expect } from 'vitest';
import { resolveEntitlement, checkLimit, hasFeature, FREE } from '@/features/billing/entitlements';
import { PLANS } from '@/features/billing/plans';
import type { MirroredSubscription } from '@/features/billing/types';

function sub(over: Partial<MirroredSubscription> = {}): MirroredSubscription {
  return {
    tier: 'pro',
    status: 'active',
    currentPeriodEnd: new Date(Date.now() + 30 * 86400_000).toISOString(),
    cancelAtPeriodEnd: false,
    trialEnd: null,
    ...over,
  };
}

describe('entitlement resolution (fail-closed, access-to-period-end)', () => {
  it('maps active/trialing to the plan tier', () => {
    expect(resolveEntitlement(sub({ tier: 'pro', status: 'active' })).tier).toBe('pro');
    expect(resolveEntitlement(sub({ tier: 'trader', status: 'trialing' })).tier).toBe('trader');
  });

  it('FAILS CLOSED to Free on null / unknown / incomplete / unpaid', () => {
    expect(resolveEntitlement(null)).toEqual(FREE);
    expect(resolveEntitlement(undefined)).toEqual(FREE);
    expect(resolveEntitlement(sub({ status: 'incomplete' })).tier).toBe('free');
    expect(resolveEntitlement(sub({ status: 'unpaid' })).tier).toBe('free');
    // Unknown tier string also collapses to Free.
    expect(resolveEntitlement(sub({ tier: 'enterprise' as never })).tier).toBe('free');
  });

  it('keeps access during the past_due grace window, flagged', () => {
    const ent = resolveEntitlement(sub({ tier: 'pro', status: 'past_due' }));
    expect(ent.tier).toBe('pro');
    expect(ent.inGracePeriod).toBe(true);
  });

  it('keeps a canceled plan until period end, then downgrades to Free', () => {
    const future = resolveEntitlement(
      sub({
        tier: 'pro',
        status: 'canceled',
        currentPeriodEnd: new Date(Date.now() + 86400_000).toISOString(),
      }),
    );
    expect(future.tier).toBe('pro');
    const past = resolveEntitlement(
      sub({
        tier: 'pro',
        status: 'canceled',
        currentPeriodEnd: new Date(Date.now() - 86400_000).toISOString(),
      }),
    );
    expect(past.tier).toBe('free');
  });

  it('surfaces endingAt when cancel_at_period_end is set', () => {
    const ent = resolveEntitlement(sub({ cancelAtPeriodEnd: true }));
    expect(ent.endingAt).toBeTruthy();
  });
});

describe('server-side limit enforcement', () => {
  it('rejects the 51st trade on Free (cap = 50)', () => {
    const ent = resolveEntitlement(null); // Free
    expect(ent.limits.maxTrades).toBe(50);
    expect(checkLimit(ent, 'maxTrades', 49).allowed).toBe(true);
    expect(checkLimit(ent, 'maxTrades', 50).allowed).toBe(false); // 51st blocked
    expect(checkLimit(ent, 'maxTrades', 50).reason).toMatch(/limit of 50/i);
  });

  it('treats null limits as unlimited on paid tiers', () => {
    const pro = resolveEntitlement(sub({ tier: 'pro' }));
    expect(checkLimit(pro, 'maxTrades', 10_000).allowed).toBe(true);
  });

  it('gates features per tier', () => {
    expect(hasFeature(FREE, 'aiCoach')).toBe(false);
    expect(hasFeature(resolveEntitlement(sub({ tier: 'pro' })), 'aiCoach')).toBe(true);
    expect(hasFeature(resolveEntitlement(sub({ tier: 'trader' })), 'aiCoach')).toBe(false);
  });
});

describe('plan config integrity', () => {
  it('every tier has coherent limits/features and prices', () => {
    for (const tier of Object.keys(PLANS) as (keyof typeof PLANS)[]) {
      const p = PLANS[tier];
      expect(p.name).toBeTruthy();
      expect(p.priceMonthly).toBeGreaterThanOrEqual(0);
      // Money is stored in integer cents (no floats → no rounding drift).
      expect(Number.isInteger(p.priceMonthly)).toBe(true);
    }
  });
});
