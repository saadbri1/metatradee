/**
 * THE entitlement matrix, asserted per fixture user.
 *
 * The matrix below is written out explicitly rather than derived from PLANS,
 * so it is an independent statement of intent: if someone edits the plan config
 * these fail, which is the point. Everything is driven through the real
 * resolver via the fixture users, so this exercises the same code path a
 * server gate takes.
 */
import { describe, it, expect } from 'vitest';
import { entitlementOf, FREE_EQUIVALENT, type FixtureName } from '../../fixtures/plan-users';
import { hasFeature, checkLimit } from '@/features/billing/entitlements';
import { gateForPath, GATED_ROUTES, minimumTierFor } from '@/features/billing/access';
import { lockedNavIds } from '@/features/shell/nav';
import { COMING_SOON, type PlanFeatures, type PlanLimits } from '@/features/billing/plans';

type Cell = boolean;
const _ = false; // denied — reads as a gap in the table
const X = true; // granted

/**
 * feature  ×  fixture user.  Columns: free, noSub, trialActive, trialExpired,
 * trader, pro, funded.
 */
const FEATURE_MATRIX: Record<keyof PlanFeatures, Record<FixtureName, Cell>> = {
  brokerImport: {
    free: _,
    noSubscription: _,
    trialExpired: _,
    trialActive: X,
    trader: X,
    pro: X,
    funded: X,
  },
  advancedAnalytics: {
    free: _,
    noSubscription: _,
    trialExpired: _,
    trialActive: X,
    trader: X,
    pro: X,
    funded: X,
  },
  reportsExport: {
    free: _,
    noSubscription: _,
    trialExpired: _,
    trialActive: X,
    trader: X,
    pro: X,
    funded: X,
  },
  playbookAdvanced: {
    free: _,
    noSubscription: _,
    trialExpired: _,
    trialActive: X,
    trader: _,
    pro: X,
    funded: X,
  },
  tradeReplay: {
    free: _,
    noSubscription: _,
    trialExpired: _,
    trialActive: X,
    trader: _,
    pro: X,
    funded: X,
  },
  aiCoach: {
    free: _,
    noSubscription: _,
    trialExpired: _,
    trialActive: X,
    trader: _,
    pro: X,
    funded: X,
  },
  // Withheld on trial even though Pro grants it — a trial must not publish
  // links that outlive the trial.
  reportSharing: {
    free: _,
    noSubscription: _,
    trialExpired: _,
    trialActive: _,
    trader: _,
    pro: X,
    funded: X,
  },
  // Not built. No plan, ever.
  propFirmTools: {
    free: _,
    noSubscription: _,
    trialExpired: _,
    trialActive: _,
    trader: _,
    pro: _,
    funded: _,
  },
};

/** limit × fixture user. `null` means unlimited. */
const LIMIT_MATRIX: Record<keyof PlanLimits, Record<FixtureName, number | null>> = {
  maxTrades: {
    free: 50,
    noSubscription: 50,
    trialExpired: 50,
    trialActive: 500,
    trader: null,
    pro: null,
    funded: null,
  },
  maxAccounts: {
    free: 1,
    noSubscription: 1,
    trialExpired: 1,
    trialActive: 2,
    trader: 3,
    pro: 10,
    funded: null,
  },
  maxStrategies: {
    free: 2,
    noSubscription: 2,
    trialExpired: 2,
    trialActive: 10,
    trader: 20,
    pro: null,
    funded: null,
  },
  maxReportsPerMonth: {
    free: 1,
    noSubscription: 1,
    trialExpired: 1,
    trialActive: 5,
    trader: 20,
    pro: null,
    funded: null,
  },
  aiReviewsPerMonth: {
    free: 0,
    noSubscription: 0,
    trialExpired: 0,
    trialActive: 5,
    trader: 10,
    pro: null,
    funded: null,
  },
};

const FIXTURES = Object.keys(FEATURE_MATRIX.aiCoach) as FixtureName[];

describe('capability matrix — every feature × every plan', () => {
  for (const [feature, row] of Object.entries(FEATURE_MATRIX) as [
    keyof PlanFeatures,
    Record<FixtureName, Cell>,
  ][]) {
    for (const fixture of FIXTURES) {
      const expected = row[fixture];
      it(`${fixture} ${expected ? 'HAS' : 'does NOT have'} ${feature}`, () => {
        expect(hasFeature(entitlementOf(fixture), feature)).toBe(expected);
      });
    }
  }
});

describe('limit matrix — every limit × every plan', () => {
  for (const [limit, row] of Object.entries(LIMIT_MATRIX) as [
    keyof PlanLimits,
    Record<FixtureName, number | null>,
  ][]) {
    for (const fixture of FIXTURES) {
      it(`${fixture} ${limit} is ${row[fixture] ?? 'unlimited'}`, () => {
        expect(entitlementOf(fixture).limits[limit]).toBe(row[fixture]);
      });
    }
  }
});

describe('no plan can reach above itself', () => {
  it('Free cannot access any Trader, Pro or Funded capability', () => {
    const ent = entitlementOf('free');
    for (const feature of Object.keys(FEATURE_MATRIX) as (keyof PlanFeatures)[]) {
      expect(hasFeature(ent, feature), `free must not have ${feature}`).toBe(false);
    }
  });

  it('Trader cannot access Pro-only or Funded-only capabilities', () => {
    const ent = entitlementOf('trader');
    for (const feature of [
      'aiCoach',
      'reportSharing',
      'tradeReplay',
      'playbookAdvanced',
    ] as const) {
      expect(hasFeature(ent, feature), `trader must not have ${feature}`).toBe(false);
    }
  });

  it('Pro is not limited by anything Funded-only that actually exists', () => {
    // Funded grants no CAPABILITY that Pro lacks — it differs on limits only.
    // Stating this explicitly stops a future "Funded-only feature" being sold
    // without a matching gate.
    const pro = entitlementOf('pro');
    const funded = entitlementOf('funded');
    expect(pro.features).toEqual(funded.features);
    // The real Funded difference: unlimited accounts.
    expect(pro.limits.maxAccounts).toBe(10);
    expect(funded.limits.maxAccounts).toBeNull();
  });

  it('Funded gets every capability that ships', () => {
    const ent = entitlementOf('funded');
    for (const feature of Object.keys(FEATURE_MATRIX) as (keyof PlanFeatures)[]) {
      if (feature in COMING_SOON) continue;
      expect(hasFeature(ent, feature), `funded should have ${feature}`).toBe(true);
    }
  });

  it('no plan gets a capability that does not exist', () => {
    for (const fixture of FIXTURES) {
      for (const feature of Object.keys(COMING_SOON)) {
        const ent = entitlementOf(fixture);
        if (feature in ent.features) {
          expect(
            hasFeature(ent, feature as keyof PlanFeatures),
            `${fixture} must not have unbuilt ${feature}`,
          ).toBe(false);
        }
      }
    }
  });
});

describe('states that must collapse to Free', () => {
  it.each(FREE_EQUIVALENT)('%s resolves to exactly the Free entitlement', (fixture) => {
    const ent = entitlementOf(fixture);
    const free = entitlementOf('free');
    expect(ent.tier).toBe('free');
    expect(ent.features).toEqual(free.features);
    expect(ent.limits).toEqual(free.limits);
  });

  it('an expired trial keeps nothing from the plan it was trialling', () => {
    const expired = entitlementOf('trialExpired');
    const active = entitlementOf('trialActive');
    expect(active.tier).toBe('pro');
    expect(expired.tier).toBe('free');
    expect(hasFeature(expired, 'aiCoach')).toBe(false);
    expect(hasFeature(active, 'aiCoach')).toBe(true);
  });
});

describe('route protection per plan', () => {
  const ROUTE_ACCESS: Record<string, Record<FixtureName, Cell>> = {
    '/ai-coach': {
      free: _,
      noSubscription: _,
      trialExpired: _,
      trialActive: X,
      trader: _,
      pro: X,
      funded: X,
    },
    '/analytics': {
      free: _,
      noSubscription: _,
      trialExpired: _,
      trialActive: X,
      trader: X,
      pro: X,
      funded: X,
    },
    '/journal/import': {
      free: _,
      noSubscription: _,
      trialExpired: _,
      trialActive: X,
      trader: X,
      pro: X,
      funded: X,
    },
  };

  it('covers every gated route — a new gated route must be added here', () => {
    expect(Object.keys(ROUTE_ACCESS).sort()).toEqual(GATED_ROUTES.map((r) => r.path).sort());
  });

  for (const [path, row] of Object.entries(ROUTE_ACCESS)) {
    for (const fixture of FIXTURES) {
      it(`${fixture} ${row[fixture] ? 'may open' : 'is blocked from'} ${path}`, () => {
        const gate = gateForPath(path)!;
        expect(hasFeature(entitlementOf(fixture), gate.feature)).toBe(row[fixture]);
      });
    }
  }

  it('ungated routes stay open to every plan', () => {
    for (const path of [
      '/dashboard',
      '/journal',
      '/reports',
      '/playbook',
      '/billing',
      '/settings/profile',
    ]) {
      expect(gateForPath(path), `${path} must not be capability-gated`).toBeNull();
    }
  });
});

describe('sidebar lock state per plan', () => {
  const EXPECTED_LOCKS: Record<FixtureName, string[]> = {
    free: ['ai-coach', 'analytics'],
    noSubscription: ['ai-coach', 'analytics'],
    trialExpired: ['ai-coach', 'analytics'],
    trialActive: [],
    trader: ['ai-coach'],
    pro: [],
    funded: [],
  };

  it.each(FIXTURES)('%s sees the right lock icons', (fixture) => {
    const locked = [...lockedNavIds(entitlementOf(fixture).features)].sort();
    expect(locked).toEqual([...EXPECTED_LOCKS[fixture]].sort());
  });

  it('a locked section is still listed — never hidden', () => {
    // Premium items stay visible so the user can see what the product does.
    const locked = lockedNavIds(entitlementOf('free').features);
    for (const id of locked) {
      expect(GATED_ROUTES.some((r) => r.path.includes(id))).toBe(true);
    }
  });
});

describe('upsells name a plan that can actually be bought', () => {
  it.each(GATED_ROUTES.map((r) => r.feature))('%s names a real granting tier', (feature) => {
    const tier = minimumTierFor(feature);
    expect(tier).not.toBeNull();
    expect(hasFeature(entitlementOf(tier as FixtureName), feature)).toBe(true);
  });
});

describe('usage limits are enforced from the resolved entitlement', () => {
  it('Free is blocked at its trade cap and allowed below it', () => {
    const ent = entitlementOf('free');
    expect(checkLimit(ent, 'maxTrades', 49).allowed).toBe(true);
    expect(checkLimit(ent, 'maxTrades', 50).allowed).toBe(false);
  });

  it('Free cannot add a second trading account', () => {
    const ent = entitlementOf('free');
    expect(checkLimit(ent, 'maxAccounts', 1).allowed).toBe(false);
  });

  it('an active trial is capped even where Pro is unlimited', () => {
    expect(entitlementOf('pro').limits.maxTrades).toBeNull();
    const trial = entitlementOf('trialActive');
    expect(checkLimit(trial, 'maxTrades', 500).allowed).toBe(false);
  });

  it('Funded is unlimited on every limit that has an unlimited tier', () => {
    const ent = entitlementOf('funded');
    for (const key of Object.keys(LIMIT_MATRIX) as (keyof PlanLimits)[]) {
      expect(ent.limits[key], `funded ${key}`).toBeNull();
    }
  });
});
