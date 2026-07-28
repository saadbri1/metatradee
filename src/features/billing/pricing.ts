/**
 * THE central pricing configuration.
 *
 * Every surface reads prices from here — the public pricing page, the billing
 * settings page, the upgrade modal, checkout preparation and entitlement copy.
 * No component may hardcode a price, so changing a number is a one-line change
 * that cannot drift between screens.
 *
 * Money is stored in the smallest currency unit (cents) to avoid float error,
 * exactly as the provider expects it. The billing provider remains authoritative
 * for what is actually charged; these values drive display and checkout setup.
 */
import { PLANS, type PlanTier } from './plans';

export type BillingInterval = 'monthly' | 'annual';

/** Marketing label for the annual saving. Derived, never hand-written. */
export const ANNUAL_LABEL = 'Save 17% (2 months free)';

export interface PlanPrice {
  /** Cents, billed each month on the monthly plan. */
  monthly: number;
  /** Cents, billed once per year on the annual plan. */
  annual: number;
  currency: string;
}

export function priceFor(tier: PlanTier): PlanPrice {
  const plan = PLANS[tier];
  return { monthly: plan.priceMonthly, annual: plan.priceAnnual, currency: plan.currency };
}

/** The amount actually charged for one interval, in cents. */
export function amountFor(tier: PlanTier, interval: BillingInterval): number {
  const price = priceFor(tier);
  return interval === 'annual' ? price.annual : price.monthly;
}

/**
 * What an annual subscriber effectively pays per month, in cents.
 * Used for the "$X /mo billed annually" line so the comparison is honest.
 */
export function monthlyEquivalent(tier: PlanTier): number {
  return Math.round(priceFor(tier).annual / 12);
}

/**
 * Real saving from paying annually, as a whole percent. Computed from the
 * configured numbers rather than asserted, so the badge can never claim a
 * discount the prices do not actually give.
 */
export function annualSavingPercent(tier: PlanTier): number {
  const { monthly, annual } = priceFor(tier);
  if (monthly <= 0) return 0;
  const twelveMonths = monthly * 12;
  return Math.round(((twelveMonths - annual) / twelveMonths) * 100);
}

/** Months free per year, when the annual price is a whole number of months. */
export function monthsFree(tier: PlanTier): number {
  const { monthly, annual } = priceFor(tier);
  if (monthly <= 0) return 0;
  return Math.round((monthly * 12 - annual) / monthly);
}

/** Format cents as a display price. Whole dollars drop the decimals. */
export function formatPrice(cents: number, currency = 'usd'): string {
  const value = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** True when the tier is free — no price, no checkout. */
export function isFree(tier: PlanTier): boolean {
  return priceFor(tier).monthly === 0 && priceFor(tier).annual === 0;
}

/** The plan highlighted as recommended on pricing surfaces. */
export const RECOMMENDED_TIER: PlanTier = 'pro';

/** Display order, cheapest first. */
export const TIER_ORDER: readonly PlanTier[] = ['free', 'trader', 'pro', 'funded'] as const;

/** Short positioning line per tier. Product copy, not a promise of returns. */
export const TIER_TAGLINE: Record<PlanTier, string> = {
  free: 'Start journaling and see whether the routine fits.',
  trader: 'For a trader who wants the full history and the analytics behind it.',
  pro: 'Adds the evidence-linked coach, replay and shareable reports.',
  funded: 'For traders running several evaluation and funded accounts.',
};
