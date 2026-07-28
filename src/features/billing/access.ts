/**
 * Route → capability registry (pure, shared by server guards and navigation).
 *
 * A route appears here ONLY when its whole purpose is a gated capability, so a
 * user without the entitlement would land on an inert page. Partly-gated
 * surfaces are deliberately absent — they stay reachable and gate the specific
 * action instead:
 *
 *  - `/reports` — generating and viewing a report privately is free on every
 *    plan; only export (`reportsExport`) and public sharing (`reportSharing`)
 *    are paid, and those are enforced in the report server actions.
 *  - `/journal`, `/playbook`, `/goals` — limited by COUNT, not by capability.
 *    Existing data is never locked away; only new over-limit additions are
 *    refused, by `assertWithinLimit`.
 *
 * The page guard is server-side and authoritative. This registry drives the
 * lock affordance in navigation so the two can never disagree.
 */
import { PLANS, TIER_RANK, type PlanFeatures, type PlanTier } from './plans';

export interface GatedRoute {
  /** Path prefix. Matches the route and everything beneath it. */
  path: string;
  feature: keyof PlanFeatures;
  /** Names the value in the locked state. Never a promise of returns. */
  title: string;
  description: string;
}

export const GATED_ROUTES: readonly GatedRoute[] = [
  {
    path: '/ai-coach',
    feature: 'aiCoach',
    title: 'AI Coach is a paid feature',
    description:
      'The coach reviews your recorded trades and cites the specific ones behind every observation. Every action on this page needs the entitlement, so there is nothing to show without it.',
  },
  {
    path: '/analytics',
    feature: 'advancedAnalytics',
    title: 'Advanced analytics is a paid feature',
    description:
      'Breakdowns by setup, symbol, time and behaviour, with the risk and performance tabs. Your dashboard summary stays available on every plan.',
  },
  {
    path: '/journal/import',
    feature: 'brokerImport',
    title: 'Broker import is a paid feature',
    description:
      'Import fills from a broker file or a connected account. Adding trades by hand stays available on every plan.',
  },
] as const;

/**
 * The gate for a pathname, or null when the route is not capability-gated.
 * Longest prefix wins, so `/journal/import` gates without gating `/journal`.
 */
export function gateForPath(pathname: string): GatedRoute | null {
  const matches = GATED_ROUTES.filter(
    (r) => pathname === r.path || pathname.startsWith(`${r.path}/`),
  );
  if (matches.length === 0) return null;
  return matches.reduce((best, r) => (r.path.length > best.path.length ? r : best));
}

/**
 * The cheapest tier that actually includes a feature — derived from the plan
 * matrix so upsell copy can never name a tier that does not grant it. Returns
 * null for a capability no tier grants (i.e. not built yet).
 */
export function minimumTierFor(feature: keyof PlanFeatures): PlanTier | null {
  const granting = (Object.keys(PLANS) as PlanTier[])
    .filter((tier) => PLANS[tier].features[feature])
    .sort((a, b) => TIER_RANK[a] - TIER_RANK[b]);
  return granting[0] ?? null;
}

/** Display name of the cheapest granting tier, e.g. "Pro". */
export function minimumPlanNameFor(feature: keyof PlanFeatures): string | null {
  const tier = minimumTierFor(feature);
  return tier ? PLANS[tier].name : null;
}
