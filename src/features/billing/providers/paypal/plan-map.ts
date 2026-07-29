/**
 * THE PayPal plan mapping — server-only.
 *
 * A PayPal plan id is an opaque string created in the PayPal dashboard. It is
 * the ONLY thing PayPal knows about what the user bought, so the mapping
 * between "PayPal plan id" and "MetaTradee tier + interval" is the security
 * boundary for pricing: get it wrong and someone pays for Trader and receives
 * Funded.
 *
 * Two rules make that hard to get wrong:
 *
 *  1. The map is built ONCE from env and is bidirectional. Checkout resolves
 *     tier+interval → plan id; the webhook resolves plan id → tier+interval.
 *     Both directions come from the same table, so they cannot disagree.
 *  2. Every lookup FAILS CLOSED. A plan id we do not recognise never yields a
 *     tier — it is reported for review and the user resolves to Free.
 *
 * Plan ids are never hardcoded in a component; they never need to reach the
 * browser at all, because the browser sends us a tier + interval and the server
 * decides which PayPal plan that is.
 */
import 'server-only';
import { serverEnv } from '@/config/env';
import type { BillingInterval } from '../../pricing';
import type { PlanTier } from '../../plans';

/** Tiers that can be bought. Free never creates a PayPal subscription. */
export const PAYABLE_TIERS = ['trader', 'pro', 'funded'] as const;
export type PayableTier = (typeof PAYABLE_TIERS)[number];

export function isPayableTier(v: string): v is PayableTier {
  return (PAYABLE_TIERS as readonly string[]).includes(v);
}

export interface PlanBinding {
  tier: PayableTier;
  interval: BillingInterval;
  paypalPlanId: string;
}

const ENV_KEYS: Record<PayableTier, Record<BillingInterval, string>> = {
  trader: {
    monthly: 'PAYPAL_TRADER_MONTHLY_PLAN_ID',
    annual: 'PAYPAL_TRADER_YEARLY_PLAN_ID',
  },
  pro: {
    monthly: 'PAYPAL_PRO_MONTHLY_PLAN_ID',
    annual: 'PAYPAL_PRO_YEARLY_PLAN_ID',
  },
  funded: {
    monthly: 'PAYPAL_FUNDED_MONTHLY_PLAN_ID',
    annual: 'PAYPAL_FUNDED_YEARLY_PLAN_ID',
  },
};

/** Every configured binding. Missing env entries are simply absent. */
export function planBindings(): PlanBinding[] {
  const env = serverEnv() as unknown as Record<string, string | undefined>;
  const out: PlanBinding[] = [];
  for (const tier of PAYABLE_TIERS) {
    for (const interval of ['monthly', 'annual'] as BillingInterval[]) {
      const id = env[ENV_KEYS[tier][interval]];
      if (id && id.length > 0) out.push({ tier, interval, paypalPlanId: id });
    }
  }
  return out;
}

/**
 * The PayPal plan id for a tier + interval, or null when it is not configured.
 * Null must be treated as "cannot sell this yet", never as a default.
 */
export function paypalPlanIdFor(tier: PlanTier, interval: BillingInterval): string | null {
  if (!isPayableTier(tier)) return null; // Free is never sold.
  return (
    planBindings().find((b) => b.tier === tier && b.interval === interval)?.paypalPlanId ?? null
  );
}

/**
 * Reverse lookup used by the webhook and by subscription verification.
 * An unrecognised plan id returns null — the caller resolves the user to Free
 * and flags it, rather than guessing a tier.
 */
export function bindingForPaypalPlanId(
  paypalPlanId: string | null | undefined,
): PlanBinding | null {
  if (!paypalPlanId) return null;
  return planBindings().find((b) => b.paypalPlanId === paypalPlanId) ?? null;
}

/**
 * Assert that a plan id really is the one we expect for this tier + interval.
 *
 * This is the check that stops a tampered client: the browser asks for
 * "pro / annual", PayPal reports back which plan was actually approved, and
 * these must agree. A mismatch is refused rather than reconciled.
 */
export function bindingMatches(
  tier: PlanTier,
  interval: BillingInterval,
  paypalPlanId: string | null | undefined,
): boolean {
  const expected = paypalPlanIdFor(tier, interval);
  return expected !== null && !!paypalPlanId && expected === paypalPlanId;
}

/** True when every payable tier/interval combination has a plan id. */
export function isPlanMapComplete(): boolean {
  return planBindings().length === PAYABLE_TIERS.length * 2;
}

/** Names of the env vars still missing — for a truthful "not configured" state. */
export function missingPlanEnvKeys(): string[] {
  const env = serverEnv() as unknown as Record<string, string | undefined>;
  const missing: string[] = [];
  for (const tier of PAYABLE_TIERS) {
    for (const interval of ['monthly', 'annual'] as BillingInterval[]) {
      const key = ENV_KEYS[tier][interval];
      if (!env[key]) missing.push(key);
    }
  }
  return missing;
}
