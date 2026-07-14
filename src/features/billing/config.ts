/**
 * Provider Price id mapping — sourced from env, NEVER hardcoded in feature code
 * (swapping a price is a config change). Server-only. Falls back to a mock id so
 * the checkout flow works end-to-end without a live provider.
 */
import type { PlanTier } from './plans';

export type BillingInterval = 'monthly' | 'annual';

/** Env var name convention, e.g. STRIPE_PRICE_TRADER_MONTHLY. */
function envKey(tier: PlanTier, interval: BillingInterval): string {
  return `STRIPE_PRICE_${tier.toUpperCase()}_${interval.toUpperCase()}`;
}

export function priceIdFor(tier: PlanTier, interval: BillingInterval): string {
  const fromEnv = process.env[envKey(tier, interval)];
  return fromEnv && fromEnv.length > 0 ? fromEnv : `price_mock_${tier}_${interval}`;
}

/** Build the reverse price→tier map from env (for webhook interpretation). */
export function buildPriceTierMap(): Record<string, PlanTier> {
  const map: Record<string, PlanTier> = {};
  const tiers: PlanTier[] = ['trader', 'pro', 'funded'];
  const intervals: BillingInterval[] = ['monthly', 'annual'];
  for (const tier of tiers) {
    for (const interval of intervals) {
      const id = process.env[envKey(tier, interval)];
      if (id) map[id] = tier;
    }
  }
  return map;
}
