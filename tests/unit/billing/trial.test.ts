/**
 * Trial model.
 *
 * Two defects motivated these: `trialEnd` was stored but never read by any
 * authorization decision (so a row left at `trialing` granted the paid tier
 * forever), and a trial resolved to the FULL tier rather than a declared
 * subset.
 */
import { describe, it, expect } from 'vitest';
import { PLANS, trialGrantFor, type PlanTier } from '@/features/billing/plans';
import { resolveEntitlement, hasFeature, checkLimit } from '@/features/billing/entitlements';
import type { MirroredSubscription } from '@/features/billing/types';

const NOW = new Date('2026-07-29T12:00:00.000Z');
const FUTURE = '2026-08-10T12:00:00.000Z';
const PAST = '2026-07-01T12:00:00.000Z';

function trialing(over: Partial<MirroredSubscription> = {}): MirroredSubscription {
  return {
    tier: 'pro',
    status: 'trialing',
    currentPeriodEnd: FUTURE,
    cancelAtPeriodEnd: false,
    trialEnd: FUTURE,
    ...over,
  };
}

const PAID: PlanTier[] = ['trader', 'pro', 'funded'];

describe('an expired trial becomes Free without waiting for the provider', () => {
  it('grants nothing once trialEnd has passed', () => {
    const ent = resolveEntitlement(trialing({ trialEnd: PAST, currentPeriodEnd: PAST }), NOW);
    expect(ent.tier).toBe('free');
    expect(Object.values(ent.features).every((v) => v === false)).toBe(true);
  });

  it('expires on its own clock even while the row still says trialing', () => {
    // The exact regression: a missed or delayed webhook leaves status at
    // `trialing`. Access must still end on time.
    const stale = trialing({ trialEnd: PAST, currentPeriodEnd: FUTURE });
    expect(stale.status).toBe('trialing');
    expect(resolveEntitlement(stale, NOW).tier).toBe('free');
  });

  it('treats a trial with no end date as expired, never as infinite', () => {
    const ent = resolveEntitlement(trialing({ trialEnd: null, currentPeriodEnd: null }), NOW);
    expect(ent.tier).toBe('free');
  });

  it('still grants an in-progress trial', () => {
    const ent = resolveEntitlement(trialing(), NOW);
    expect(ent.tier).toBe('pro');
    expect(ent.status).toBe('trialing');
    expect(ent.endingAt).toBe(FUTURE);
  });
});

describe('a trial is a declared subset, not the whole plan', () => {
  it('never grants a capability the paid plan does not have', () => {
    // The trial is a subset: it may match the tier on capabilities it always
    // had (Trader has no reportSharing to withhold, so only its limits narrow),
    // but it must never exceed the plan it is a trial of.
    for (const tier of PAID) {
      const grant = trialGrantFor(tier);
      for (const [key, enabled] of Object.entries(grant.features)) {
        if (enabled) {
          expect(
            PLANS[tier].features[key as keyof typeof grant.features],
            `${tier} trial must not grant ${key} beyond its plan`,
          ).toBe(true);
        }
      }
    }
  });

  it('is strictly narrower than the top plan it can trial', () => {
    // Funded is the full platform; its trial must be visibly less than that.
    const grant = trialGrantFor('funded');
    expect(grant.features).not.toEqual(PLANS.funded.features);
    expect(grant.limits).not.toEqual(PLANS.funded.limits);
  });

  it('withholds public report sharing on every trial', () => {
    for (const tier of PAID) {
      expect(trialGrantFor(tier).features.reportSharing, tier).toBe(false);
    }
    // Even though the paid plan grants it.
    expect(PLANS.pro.features.reportSharing).toBe(true);
    const ent = resolveEntitlement(trialing(), NOW);
    expect(hasFeature(ent, 'reportSharing')).toBe(false);
  });

  it('never inherits an unlimited limit — every trial cap is finite', () => {
    for (const tier of PAID) {
      const limits = trialGrantFor(tier).limits;
      for (const [key, value] of Object.entries(limits)) {
        expect(value, `${tier} trial ${key} must be finite`).not.toBeNull();
        expect(typeof value).toBe('number');
      }
    }
    // Pro itself is unlimited on trades; its trial is not.
    expect(PLANS.pro.limits.maxTrades).toBeNull();
    expect(trialGrantFor('pro').limits.maxTrades).toBe(500);
  });

  it('never exceeds the paid plan it is a trial of', () => {
    for (const tier of PAID) {
      const trial = trialGrantFor(tier).limits;
      const paid = PLANS[tier].limits;
      for (const key of Object.keys(paid) as (keyof typeof paid)[]) {
        const cap = paid[key];
        if (cap !== null) expect(trial[key] as number, `${tier}.${key}`).toBeLessThanOrEqual(cap);
      }
    }
  });

  it('enforces the trial cap through the same limit checker the gates use', () => {
    const ent = resolveEntitlement(trialing(), NOW);
    expect(checkLimit(ent, 'aiReviewsPerMonth', 4).allowed).toBe(true);
    expect(checkLimit(ent, 'aiReviewsPerMonth', 5).allowed).toBe(false);
  });

  it('still grants the capabilities the trial is meant to demonstrate', () => {
    const ent = resolveEntitlement(trialing(), NOW);
    expect(hasFeature(ent, 'aiCoach')).toBe(true);
    expect(hasFeature(ent, 'advancedAnalytics')).toBe(true);
    expect(hasFeature(ent, 'tradeReplay')).toBe(true);
  });

  it('grants a trial no capability the tier itself lacks', () => {
    const traderTrial = trialGrantFor('trader');
    expect(traderTrial.features.aiCoach).toBe(false);
    expect(PLANS.trader.features.aiCoach).toBe(false);
  });
});

describe('other statuses are unchanged by the trial work', () => {
  it('active still grants the full tier', () => {
    const ent = resolveEntitlement(
      {
        tier: 'pro',
        status: 'active',
        currentPeriodEnd: FUTURE,
        cancelAtPeriodEnd: false,
        trialEnd: null,
      },
      NOW,
    );
    expect(ent.features).toEqual(PLANS.pro.features);
    expect(ent.limits).toEqual(PLANS.pro.limits);
  });

  it('past_due keeps access during the retry window', () => {
    const ent = resolveEntitlement(
      {
        tier: 'pro',
        status: 'past_due',
        currentPeriodEnd: FUTURE,
        cancelAtPeriodEnd: false,
        trialEnd: null,
      },
      NOW,
    );
    expect(ent.tier).toBe('pro');
    expect(ent.inGracePeriod).toBe(true);
  });

  it('an ended cancellation falls back to Free', () => {
    const ent = resolveEntitlement(
      {
        tier: 'pro',
        status: 'canceled',
        currentPeriodEnd: PAST,
        cancelAtPeriodEnd: true,
        trialEnd: null,
      },
      NOW,
    );
    expect(ent.tier).toBe('free');
  });
});
