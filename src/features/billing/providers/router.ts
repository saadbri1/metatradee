/**
 * Provider selection. The only place that knows which billing vendor is active.
 * Chosen by config/env; falls back to the deterministic mock when no secret is
 * configured (so builds/tests never require a live provider or make charges).
 * Secret + webhook keys are read server-side only.
 */
import { serverEnv } from '@/config/env';
import type { BillingProvider } from './types';
import { StripeProvider } from './stripe';
import { MockBillingProvider } from './mock';
import { isPayPalConfigured } from './paypal/client';

export function getBillingProvider(): BillingProvider {
  const env = serverEnv();
  const provider = env.BILLING_PROVIDER ?? (env.STRIPE_SECRET_KEY ? 'stripe' : 'mock');
  if (provider === 'stripe' && env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) {
    return new StripeProvider(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET);
  }
  // Paddle adapter is a documented seam (not implemented) — same interface.
  return new MockBillingProvider(env.STRIPE_WEBHOOK_SECRET || undefined);
}

/**
 * True when NO payment provider of any kind can take money.
 *
 * This used to ask only "is Stripe configured", which silently made PayPal
 * invisible: with PayPal fully set up and no Stripe keys it still reported
 * mock, so every checkout CTA rendered as "Not available yet" and the pricing
 * page kept saying plans were not on sale. The question is provider-agnostic,
 * so the answer must be too.
 *
 * PayPal counts when its CREDENTIALS are present. It no longer also requires
 * the six subscription plan ids: checkout is one-time Orders now, which sells
 * a price rather than a plan, so a complete plan map is no longer any part of
 * being able to take money. Requiring it would leave checkout switched off for
 * a reason that stopped applying when Subscriptions was retired.
 */
export function isBillingMock(): boolean {
  if (isPayPalConfigured()) return false;
  const env = serverEnv();
  return !(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) && env.BILLING_PROVIDER !== 'stripe';
}

/** Which provider actually handles checkout, for provider-specific UI. */
export function activeBillingProviderName(): 'paypal' | 'stripe' | 'none' {
  if (isPayPalConfigured()) return 'paypal';
  const env = serverEnv();
  if ((env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) || env.BILLING_PROVIDER === 'stripe')
    return 'stripe';
  return 'none';
}
