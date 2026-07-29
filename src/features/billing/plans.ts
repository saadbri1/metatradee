/**
 * Plan / entitlement definition — THE single source of truth mapping tier →
 * features + numeric limits + display prices. Feature code reads limits from
 * here, never hardcodes them.
 *
 * PRICES ARE FINAL and are the single source for every surface — public
 * pricing page, billing settings, upgrade modal, checkout preparation and
 * entitlement copy. Nothing may hardcode a price elsewhere; display helpers
 * live in `pricing.ts`. The provider remains authoritative for what is actually
 * charged. `priceId` values map to provider Price objects via config/env, so
 * swapping a price is a config change, not a code change.
 */

export type PlanTier = 'free' | 'trader' | 'pro' | 'funded';

/** Concrete capability flags a tier unlocks. */
export interface PlanFeatures {
  aiCoach: boolean;
  brokerImport: boolean;
  advancedAnalytics: boolean;
  reportsExport: boolean;
  reportSharing: boolean;
  /** Bar-by-bar replay of real historical sessions. Shipped. */
  tradeReplay: boolean;
  /** Playbook versioning, adherence and per-playbook performance. Shipped. */
  playbookAdvanced: boolean;
  /**
   * NOT IMPLEMENTED. The flag exists so the plan shape is stable, but no code
   * reads it and no surface may sell it — see COMING_SOON.
   */
  propFirmTools: boolean;
}

/** Numeric limits. `null` means unlimited. Enforced server-side. */
export interface PlanLimits {
  maxTrades: number | null;
  maxAccounts: number | null;
  maxStrategies: number | null;
  maxReportsPerMonth: number | null;
  aiReviewsPerMonth: number | null;
}

/**
 * What a TRIAL of a paid plan grants — deliberately NOT the whole plan.
 *
 * A trial is declared explicitly here rather than inherited from the tier, so
 * "what does a trial include" is answerable by reading one object instead of
 * inferring it from the absence of a check. Two things are withheld:
 *
 *  - `reportSharing` — a trial must not be able to publish public links that
 *    outlive the trial itself.
 *  - unlimited numeric limits — every trial limit is finite, so a trial cannot
 *    be used to run up unbounded AI or storage cost.
 *
 * These are product defaults chosen to be conservative; change them here and
 * every gate, page and upsell follows.
 */
export function trialGrantFor(tier: PlanTier): { features: PlanFeatures; limits: PlanLimits } {
  const plan = PLANS[tier];
  return {
    features: {
      ...plan.features,
      // Withheld during trial regardless of tier.
      reportSharing: false,
    },
    limits: {
      // A trial never inherits `null` (unlimited).
      maxTrades: capTrial(plan.limits.maxTrades, 500),
      maxAccounts: capTrial(plan.limits.maxAccounts, 2),
      maxStrategies: capTrial(plan.limits.maxStrategies, 10),
      maxReportsPerMonth: capTrial(plan.limits.maxReportsPerMonth, 5),
      aiReviewsPerMonth: capTrial(plan.limits.aiReviewsPerMonth, 5),
    },
  };
}

/** Trial limits are always finite: `null` becomes the cap, never unlimited. */
function capTrial(planLimit: number | null, cap: number): number {
  return planLimit === null ? cap : Math.min(planLimit, cap);
}

export interface Plan {
  tier: PlanTier;
  name: string;
  /** Display prices in the smallest currency unit (cents). Provider is truth. */
  priceMonthly: number;
  priceAnnual: number;
  currency: string;
  trialDays: number;
  features: PlanFeatures;
  limits: PlanLimits;
}

const NO_FEATURES: PlanFeatures = {
  aiCoach: false,
  brokerImport: false,
  advancedAnalytics: false,
  reportsExport: false,
  reportSharing: false,
  tradeReplay: false,
  playbookAdvanced: false,
  propFirmTools: false,
};

/**
 * Capabilities that DO NOT EXIST in the product yet.
 *
 * They may be shown as "Coming soon" and must never be presented as included
 * in a paid plan, priced, or gated as though they worked. Verified by grep:
 * there is no backtesting code in the repository, and nothing reads
 * `propFirmTools`.
 */
export const COMING_SOON = {
  manualBacktesting: 'Manual backtesting',
  automatedBacktesting: 'Automated backtesting',
  propFirmTools: 'Prop-firm rule monitoring',
} as const;

export type ComingSoonFeature = keyof typeof COMING_SOON;

export const PLANS: Record<PlanTier, Plan> = {
  free: {
    tier: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceAnnual: 0,
    currency: 'usd',
    trialDays: 0,
    features: { ...NO_FEATURES },
    limits: {
      maxTrades: 50,
      maxAccounts: 1,
      maxStrategies: 2,
      maxReportsPerMonth: 1,
      aiReviewsPerMonth: 0,
    },
  },
  trader: {
    tier: 'trader',
    name: 'Trader',
    priceMonthly: 1900,
    priceAnnual: 19000,
    currency: 'usd',
    trialDays: 14,
    features: {
      ...NO_FEATURES,
      brokerImport: true,
      advancedAnalytics: true,
      reportsExport: true,
    },
    limits: {
      maxTrades: null,
      maxAccounts: 3,
      maxStrategies: 20,
      maxReportsPerMonth: 20,
      aiReviewsPerMonth: 10,
    },
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    priceMonthly: 3900,
    priceAnnual: 39000,
    currency: 'usd',
    trialDays: 14,
    features: {
      ...NO_FEATURES,
      aiCoach: true,
      brokerImport: true,
      advancedAnalytics: true,
      reportsExport: true,
      reportSharing: true,
      tradeReplay: true,
      playbookAdvanced: true,
    },
    limits: {
      maxTrades: null,
      maxAccounts: 10,
      maxStrategies: null,
      maxReportsPerMonth: null,
      aiReviewsPerMonth: null,
    },
  },
  funded: {
    tier: 'funded',
    name: 'Funded',
    priceMonthly: 5900,
    priceAnnual: 59000,
    currency: 'usd',
    trialDays: 14,
    features: {
      ...NO_FEATURES,
      aiCoach: true,
      brokerImport: true,
      advancedAnalytics: true,
      reportsExport: true,
      reportSharing: true,
      tradeReplay: true,
      playbookAdvanced: true,
      // propFirmTools stays FALSE until it is actually built. Funded is sold on
      // unlimited accounts and priority limits, never on a capability that does
      // not exist — see COMING_SOON.
    },
    limits: {
      maxTrades: null,
      maxAccounts: null,
      maxStrategies: null,
      maxReportsPerMonth: null,
      aiReviewsPerMonth: null,
    },
  },
};

/** Tier ordering for upgrade/downgrade comparisons. */
export const TIER_RANK: Record<PlanTier, number> = { free: 0, trader: 1, pro: 2, funded: 3 };

export const PAID_TIERS: PlanTier[] = ['trader', 'pro', 'funded'];

export function isValidTier(v: string): v is PlanTier {
  return v === 'free' || v === 'trader' || v === 'pro' || v === 'funded';
}
