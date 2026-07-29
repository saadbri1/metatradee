/**
 * Authenticated fixture users, one per billing state.
 *
 * Each fixture is a mirrored subscription row exactly as the database would
 * hold it, run through the REAL resolver — not a hand-written entitlement. That
 * matters: a hand-written fixture would test the test, whereas this exercises
 * the same `resolveEntitlement` every server gate calls, so a resolver
 * regression fails these.
 */
import { resolveEntitlement } from '@/features/billing/entitlements';
import type { Entitlement, MirroredSubscription } from '@/features/billing/types';
import type { PlanTier } from '@/features/billing/plans';

/** Fixed clock so trial expiry is deterministic. */
export const NOW = new Date('2026-07-29T12:00:00.000Z');
const FUTURE = '2026-08-12T12:00:00.000Z';
const PAST = '2026-07-02T12:00:00.000Z';

export type FixtureName =
  'free' | 'noSubscription' | 'trialActive' | 'trialExpired' | 'trader' | 'pro' | 'funded';

function paid(tier: PlanTier): MirroredSubscription {
  return {
    tier,
    status: 'active',
    currentPeriodEnd: FUTURE,
    cancelAtPeriodEnd: false,
    trialEnd: null,
  };
}

export const SUBSCRIPTIONS: Record<FixtureName, MirroredSubscription | null> = {
  // No row at all — the most common real state for a signed-up user.
  free: null,
  // A row that resolves to nothing (unpaid) — must not grant access.
  noSubscription: {
    tier: 'pro',
    status: 'unpaid',
    currentPeriodEnd: FUTURE,
    cancelAtPeriodEnd: false,
    trialEnd: null,
  },
  trialActive: {
    tier: 'pro',
    status: 'trialing',
    currentPeriodEnd: FUTURE,
    cancelAtPeriodEnd: false,
    trialEnd: FUTURE,
  },
  // The dangerous one: the row still SAYS trialing (missed webhook) but the
  // trial clock has run out.
  trialExpired: {
    tier: 'pro',
    status: 'trialing',
    currentPeriodEnd: FUTURE,
    cancelAtPeriodEnd: false,
    trialEnd: PAST,
  },
  trader: paid('trader'),
  pro: paid('pro'),
  funded: paid('funded'),
};

/** The resolved entitlement each fixture user actually gets. */
export function entitlementOf(name: FixtureName): Entitlement {
  return resolveEntitlement(SUBSCRIPTIONS[name], NOW);
}

export const ALL_FIXTURES = Object.keys(SUBSCRIPTIONS) as FixtureName[];

/** Fixtures that must behave exactly like Free. */
export const FREE_EQUIVALENT: FixtureName[] = ['free', 'noSubscription', 'trialExpired'];
