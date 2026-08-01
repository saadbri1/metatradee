/**
 * Provider detection.
 *
 * A real defect this locks: isBillingMock() asked only "is Stripe configured".
 * With PayPal fully set up and no Stripe keys it still answered "mock", which
 * forced every checkout CTA to "Not available yet" and kept "Paid plans are not
 * on sale yet" on the pricing page — so the PayPal button never rendered at all.
 * The question is provider-agnostic and the answer must be too.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const paypalConfigured = vi.fn();
const planMapComplete = vi.fn();
const serverEnv = vi.fn();

vi.mock('@/features/billing/providers/paypal/client', () => ({
  isPayPalConfigured: () => paypalConfigured(),
}));
vi.mock('@/features/billing/providers/paypal/plan-map', () => ({
  isPlanMapComplete: () => planMapComplete(),
}));
vi.mock('@/config/env', () => ({ serverEnv: () => serverEnv() }));
vi.mock('@/features/billing/providers/stripe', () => ({ StripeProvider: class {} }));
vi.mock('@/features/billing/providers/mock', () => ({ MockBillingProvider: class {} }));

import { isBillingMock, activeBillingProviderName } from '@/features/billing/providers/router';

beforeEach(() => {
  serverEnv.mockReturnValue({});
  paypalConfigured.mockReturnValue(false);
  planMapComplete.mockReturnValue(false);
});
afterEach(() => vi.clearAllMocks());

describe('PayPal alone is a real provider', () => {
  it('is NOT mock when PayPal is fully configured and Stripe is absent', () => {
    paypalConfigured.mockReturnValue(true);
    planMapComplete.mockReturnValue(true);
    expect(isBillingMock()).toBe(false);
    expect(activeBillingProviderName()).toBe('paypal');
  });

  it('needs only credentials now that checkout sells a price, not a plan', () => {
    /*
     * This used to also require all six subscription plan ids. One-time Orders
     * sell an AMOUNT, so a complete plan map is no longer any part of being
     * able to take money — keeping the requirement would have left checkout
     * switched off for a reason that stopped applying when Subscriptions was
     * retired.
     */
    paypalConfigured.mockReturnValue(true);
    planMapComplete.mockReturnValue(false);
    expect(isBillingMock()).toBe(false);
    expect(activeBillingProviderName()).toBe('paypal');
  });

  it('cannot sell on plan ids alone, because nothing could be verified', () => {
    // No credentials means no capture can be read back from PayPal.
    paypalConfigured.mockReturnValue(false);
    planMapComplete.mockReturnValue(true);
    expect(isBillingMock()).toBe(true);
    expect(activeBillingProviderName()).toBe('none');
  });

  it('is mock when no provider at all is configured', () => {
    expect(isBillingMock()).toBe(true);
    expect(activeBillingProviderName()).toBe('none');
  });

  it('still recognises Stripe if it is ever configured', () => {
    serverEnv.mockReturnValue({ STRIPE_SECRET_KEY: 'x', STRIPE_WEBHOOK_SECRET: 'y' });
    expect(isBillingMock()).toBe(false);
    expect(activeBillingProviderName()).toBe('stripe');
  });

  it('prefers PayPal when both are present, since it is the launch provider', () => {
    paypalConfigured.mockReturnValue(true);
    planMapComplete.mockReturnValue(true);
    serverEnv.mockReturnValue({ STRIPE_SECRET_KEY: 'x', STRIPE_WEBHOOK_SECRET: 'y' });
    expect(activeBillingProviderName()).toBe('paypal');
  });
});
