/**
 * Route-level entitlement guards.
 *
 * Before this, only server ACTIONS were gated: a Free user could open
 * /ai-coach or /journal/import by typing the URL and receive the whole premium
 * UI with every button dead. These tests hold the guard in place and — more
 * importantly — hold the registry, the pages and the navigation in agreement.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  GATED_ROUTES,
  gateForPath,
  minimumTierFor,
  minimumPlanNameFor,
} from '@/features/billing/access';
import { PLANS, COMING_SOON, type PlanTier } from '@/features/billing/plans';
import { lockedNavIds } from '@/features/shell/nav';
import {
  EntitlementError,
  isEntitlementError,
  entitlementErrorBody,
} from '@/features/billing/errors';

const APP = resolve(__dirname, '../../../src/app/(protected)');

describe('the route registry only gates things that exist and can be bought', () => {
  it('every gated route names a real, purchasable capability', () => {
    for (const route of GATED_ROUTES) {
      // A gate on an unbuilt capability would lock a page forever with an
      // upgrade button that unlocks nothing.
      expect(Object.keys(COMING_SOON), `${route.path}`).not.toContain(route.feature);
      expect(minimumTierFor(route.feature), `${route.path} must be unlockable`).not.toBeNull();
    }
  });

  it('free is not entitled to any gated route (otherwise the gate is pointless)', () => {
    for (const route of GATED_ROUTES) {
      expect(PLANS.free.features[route.feature], route.path).toBe(false);
    }
  });

  it('names the cheapest tier that really grants the feature', () => {
    expect(minimumTierFor('aiCoach')).toBe('pro');
    expect(minimumTierFor('brokerImport')).toBe('trader');
    expect(minimumPlanNameFor('aiCoach')).toBe('Pro');
    // Derived, so it cannot name a tier that does not grant it.
    for (const route of GATED_ROUTES) {
      const tier = minimumTierFor(route.feature) as PlanTier;
      expect(PLANS[tier].features[route.feature]).toBe(true);
    }
  });

  it('returns null rather than guessing for a capability nothing grants', () => {
    expect(minimumTierFor('propFirmTools')).toBeNull();
    expect(minimumPlanNameFor('propFirmTools')).toBeNull();
  });

  it('promises no financial outcome in its copy', () => {
    for (const route of GATED_ROUTES) {
      expect(`${route.title} ${route.description}`).not.toMatch(
        /profit|guarantee|returns|win rate boost|make money/i,
      );
    }
  });
});

describe('path matching', () => {
  it('matches the route and everything beneath it', () => {
    expect(gateForPath('/ai-coach')?.feature).toBe('aiCoach');
    expect(gateForPath('/ai-coach/history')?.feature).toBe('aiCoach');
  });

  it('gives the longest prefix, so a child gate does not leak to its parent', () => {
    // /journal is limited by COUNT, not capability — it must stay open.
    expect(gateForPath('/journal')).toBeNull();
    expect(gateForPath('/journal/new')).toBeNull();
    expect(gateForPath('/journal/import')?.feature).toBe('brokerImport');
  });

  it('does not gate a partly-paid surface at page level', () => {
    // Viewing a report privately is free; only export and sharing are paid, and
    // those are enforced in the report actions.
    expect(gateForPath('/reports')).toBeNull();
    expect(gateForPath('/dashboard')).toBeNull();
    expect(gateForPath('/playbook')).toBeNull();
    expect(gateForPath('/goals')).toBeNull();
  });

  it('does not match an unrelated route that merely shares a prefix string', () => {
    expect(gateForPath('/analytics-export')).toBeNull();
  });
});

describe('every gated page actually calls the guard', () => {
  // The registry alone protects nothing. This walks the real page files.
  it.each(GATED_ROUTES.map((r) => r.path))('%s renders behind a server check', (path) => {
    const file = resolve(APP, `.${path}/page.tsx`);
    expect(existsSync(file), `${file} must exist`).toBe(true);
    const source = readFileSync(file, 'utf8');

    const checksEntitlement =
      source.includes('checkFeatureAccess') ||
      source.includes('requireFeature') ||
      (source.includes('getEntitlement') && source.includes('hasFeature'));
    expect(checksEntitlement, `${path}/page.tsx must resolve entitlement server-side`).toBe(true);
    expect(source).toContain('FeatureLocked');
    // A Server Component — a client page could not gate anything.
    expect(source.trimStart().startsWith("'use client'")).toBe(false);
  });
});

describe('navigation lock affordance is derived, never duplicated', () => {
  it('marks exactly the sections a free plan cannot open', () => {
    const locked = lockedNavIds(PLANS.free.features);
    expect([...locked].sort()).toEqual(['ai-coach', 'analytics']);
  });

  it('unlocks what a paid plan really grants', () => {
    expect(lockedNavIds(PLANS.pro.features)).toEqual([]);
    // Trader has analytics but not the coach.
    expect(lockedNavIds(PLANS.trader.features)).toEqual(['ai-coach']);
  });

  it('never marks an ungated section', () => {
    for (const tier of Object.keys(PLANS) as PlanTier[]) {
      const locked = lockedNavIds(PLANS[tier].features);
      expect(locked).not.toContain('journal');
      expect(locked).not.toContain('reports');
      expect(locked).not.toContain('dashboard');
      expect(locked).not.toContain('billing');
    }
  });
});

describe('typed 403', () => {
  const err = new EntitlementError('aiCoach', 'pro', 'Available on Pro and above.');

  it('is discriminable from a real failure', () => {
    expect(isEntitlementError(err)).toBe(true);
    expect(isEntitlementError(new Error('boom'))).toBe(false);
    expect(err.status).toBe(403);
    expect(err.code).toBe('entitlement_required');
  });

  it('leaks no subscription internals in its response body', () => {
    const body = JSON.stringify(entitlementErrorBody(err));
    expect(body).not.toMatch(/stripe|cus_|sub_|price_|secret|customer/i);
    expect(entitlementErrorBody(err).requiredTier).toBe('pro');
  });
});
