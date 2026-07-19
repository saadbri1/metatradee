/**
 * Phase 12.3 — P0 entitlement enforcement + trial-model invariants.
 *
 * These assert the CANONICAL matrix in `plans.ts` and the fail-closed resolver.
 * They are the regression net for the gates wired into the AI-coach, import, and
 * report server actions: if a plan's feature set drifts, or the resolver stops
 * failing closed, these fail before a paying/non-paying boundary breaks.
 */
import { describe, it, expect } from 'vitest';
import { PLANS, type PlanTier } from '@/features/billing/plans';
import { resolveEntitlement, hasFeature, checkLimit, FREE } from '@/features/billing/entitlements';

const PAID: PlanTier[] = ['trader', 'pro', 'funded'];

describe('canonical plan matrix (single source of truth)', () => {
  it('free enables NO paid feature flags', () => {
    for (const [key, enabled] of Object.entries(PLANS.free.features)) {
      expect(enabled, `free.${key} must be false`).toBe(false);
    }
  });

  it('aiCoach is pro-and-above only', () => {
    expect(PLANS.free.features.aiCoach).toBe(false);
    expect(PLANS.trader.features.aiCoach).toBe(false);
    expect(PLANS.pro.features.aiCoach).toBe(true);
    expect(PLANS.funded.features.aiCoach).toBe(true);
  });

  it('brokerImport and reportsExport start at trader', () => {
    expect(PLANS.free.features.brokerImport).toBe(false);
    expect(PLANS.trader.features.brokerImport).toBe(true);
    expect(PLANS.free.features.reportsExport).toBe(false);
    expect(PLANS.trader.features.reportsExport).toBe(true);
  });

  it('reportSharing is pro-and-above only', () => {
    expect(PLANS.trader.features.reportSharing).toBe(false);
    expect(PLANS.pro.features.reportSharing).toBe(true);
  });

  it('propFirmTools is funded-only', () => {
    expect(PLANS.pro.features.propFirmTools).toBe(false);
    expect(PLANS.funded.features.propFirmTools).toBe(true);
  });
});

describe('resolver fails closed (the property every gate depends on)', () => {
  it('an unresolved subscription resolves to FREE, never to a paid plan', () => {
    const ent = resolveEntitlement(null);
    expect(ent.tier).toBe(FREE.tier);
    expect(hasFeature(ent, 'aiCoach')).toBe(false);
    expect(hasFeature(ent, 'brokerImport')).toBe(false);
    expect(hasFeature(ent, 'reportsExport')).toBe(false);
    expect(hasFeature(ent, 'reportSharing')).toBe(false);
  });

  it('free is denied every gated feature the P0 work wired', () => {
    const ent = resolveEntitlement(null);
    for (const f of ['aiCoach', 'brokerImport', 'reportsExport', 'reportSharing'] as const) {
      expect(hasFeature(ent, f), `free must not have ${f}`).toBe(false);
    }
  });

  it('never invents a feature key outside the canonical matrix', () => {
    const canonical = Object.keys(PLANS.free.features).sort();
    for (const tier of PAID) {
      expect(Object.keys(PLANS[tier].features).sort()).toEqual(canonical);
    }
  });
});

describe('usage limits are enforced from config, not hardcoded', () => {
  it('free has a finite trade cap; paid tiers relax it', () => {
    expect(PLANS.free.limits.maxTrades).not.toBeNull();
    const free = PLANS.free.limits.maxTrades as number;
    for (const tier of PAID) {
      const cap = PLANS[tier].limits.maxTrades;
      expect(cap === null || cap > free).toBe(true);
    }
  });

  it('checkLimit blocks at the cap and allows below it', () => {
    const ent = resolveEntitlement(null);
    const cap = ent.limits.maxTrades as number;
    expect(checkLimit(ent, 'maxTrades', cap - 1).allowed).toBe(true);
    expect(checkLimit(ent, 'maxTrades', cap).allowed).toBe(false);
  });

  it('a blocked limit explains itself without leaking subscription internals', () => {
    const ent = resolveEntitlement(null);
    const res = checkLimit(ent, 'maxTrades', ent.limits.maxTrades as number);
    expect(res.allowed).toBe(false);
    expect(res.reason ?? '').not.toMatch(/stripe|customer|sub_|price_|secret/i);
  });
});

describe('trial model — 14 days, provider-managed, free gets none', () => {
  it('free plan has NO trial (signups are not auto-converted to trial)', () => {
    expect(PLANS.free.trialDays).toBe(0);
  });

  it('every paid tier declares a 14-day trial — 14 is canonical, not 15', () => {
    for (const tier of PAID) {
      expect(PLANS[tier].trialDays, `${tier} trialDays`).toBe(14);
    }
  });

  it('no plan advertises a 15-day trial anywhere in the matrix', () => {
    for (const tier of Object.keys(PLANS) as PlanTier[]) {
      expect(PLANS[tier].trialDays).not.toBe(15);
    }
  });

  it('a free user gains no entitlement merely by existing (no implicit trial)', () => {
    const ent = resolveEntitlement(null);
    expect(ent.tier).toBe('free');
    expect(Object.values(ent.features).every((v) => v === false)).toBe(true);
  });
});
