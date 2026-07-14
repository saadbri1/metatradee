/**
 * Plan / entitlement definition — THE single source of truth mapping tier →
 * features + numeric limits + display prices. Feature code reads limits from
 * here, never hardcodes them.
 *
 * NOTE: no finalized pricing PRD exists in the repo yet, so these tiers/prices/
 * limits are DOCUMENTED DEFAULTS to be reconciled with the pricing doc when it
 * lands (prices are display-only — the provider is authoritative for money).
 * `priceId` fields map to provider Price objects and come from config/env, not
 * hardcoded, so swapping a price is a config change.
 */

export type PlanTier = 'free' | 'trader' | 'pro' | 'funded';

/** Concrete capability flags a tier unlocks. */
export interface PlanFeatures {
  aiCoach: boolean;
  brokerImport: boolean;
  advancedAnalytics: boolean;
  reportsExport: boolean;
  reportSharing: boolean;
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
  propFirmTools: false,
};

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
    features: { ...NO_FEATURES, advancedAnalytics: true, reportsExport: true, brokerImport: true },
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
      aiCoach: true,
      brokerImport: true,
      advancedAnalytics: true,
      reportsExport: true,
      reportSharing: true,
      propFirmTools: false,
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
      aiCoach: true,
      brokerImport: true,
      advancedAnalytics: true,
      reportsExport: true,
      reportSharing: true,
      propFirmTools: true,
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
