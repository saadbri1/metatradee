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

export function getBillingProvider(): BillingProvider {
  const env = serverEnv();
  const provider = env.BILLING_PROVIDER ?? (env.STRIPE_SECRET_KEY ? 'stripe' : 'mock');
  if (provider === 'stripe' && env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) {
    return new StripeProvider(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET);
  }
  // Paddle adapter is a documented seam (not implemented) — same interface.
  return new MockBillingProvider(env.STRIPE_WEBHOOK_SECRET || undefined);
}

/** True when no live provider is configured (surface a soft notice in the UI). */
export function isBillingMock(): boolean {
  const env = serverEnv();
  return !(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) && env.BILLING_PROVIDER !== 'stripe';
}
