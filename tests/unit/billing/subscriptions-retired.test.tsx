/**
 * The retired PayPal Subscriptions path.
 *
 * Two live payment paths against one entitlement mirror is how a buyer gets
 * charged twice, or granted access by the path nobody is watching. Orders is
 * not finished, so the old flow is DISABLED rather than deleted — and these
 * tests are what make "disabled" mean something: it must not render, and it
 * must not grant.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PAYPAL_SUBSCRIPTIONS_ENABLED,
  SUBSCRIPTIONS_RETIRED_MESSAGE,
} from '@/features/billing/providers/paypal/subscriptions-disabled';

const useBillingOverview = vi.fn();
const useEntitlement = vi.fn();
const useOpenPortal = vi.fn();
const useCheckout = vi.fn();
vi.mock('@/features/billing/hooks', () => ({
  useBillingOverview: () => useBillingOverview(),
  useEntitlement: () => useEntitlement(),
  useOpenPortal: () => useOpenPortal(),
  useCheckout: () => useCheckout(),
}));

import { PlansTable } from '@/features/billing/components/plans-table';

beforeEach(() => {
  useOpenPortal.mockReturnValue({ mutate: vi.fn(), isPending: false, data: undefined });
  useCheckout.mockReturnValue({ mutate: vi.fn(), isPending: false, data: undefined });
});

describe('the kill switch is hard off', () => {
  it('is a compile-time constant, not a runtime flag', () => {
    // A runtime toggle could be flipped by accident and put both payment paths
    // live at once, which is the exact state this prevents.
    expect(PAYPAL_SUBSCRIPTIONS_ENABLED).toBe(false);
    const source = readFileSync(
      resolve(
        __dirname,
        '../../../src/features/billing/providers/paypal/subscriptions-disabled.ts',
      ),
      'utf8',
    );
    expect(source).not.toMatch(/process\.env/);
  });
});

describe('it cannot render', () => {
  it('shows no PayPal subscribe button on any paid tier', () => {
    render(<PlansTable />);
    for (const label of ['Trader plan', 'Pro plan', 'Funded plan']) {
      const card = screen.getByLabelText(label);
      expect(within(card).queryByRole('button', { name: /subscribe/i })).not.toBeInTheDocument();
      expect(within(card).queryByText(/subscribe/i)).not.toBeInTheDocument();
    }
  });

  it('offers no control that could start a subscription', () => {
    render(<PlansTable />);
    const enabled = screen
      .getAllByRole('button')
      .filter((b) => !(b as HTMLButtonElement).disabled)
      .map((b) => b.textContent ?? '');
    // Only the billing-interval toggle may be enabled.
    for (const label of enabled) {
      expect(['Monthly', 'Yearly']).toContain(label.trim());
    }
  });

  it('no longer imports the subscribe button component at all', () => {
    const source = readFileSync(
      resolve(__dirname, '../../../src/features/billing/components/plans-table.tsx'),
      'utf8',
    );
    expect(source).not.toContain('PayPalSubscribeButton');
  });
});

describe('it cannot grant entitlement', () => {
  it('refuses BEFORE auth, config or any PayPal call', async () => {
    /*
     * Ordering matters: the retirement check must be the first thing in the
     * action, so there is no path — authenticated or not, configured or not —
     * in which a subscription could still be mirrored.
     */
    const source = readFileSync(
      resolve(__dirname, '../../../src/features/billing/providers/paypal/verify-action.ts'),
      'utf8',
    );
    const retired = source.indexOf('PAYPAL_SUBSCRIPTIONS_ENABLED');
    const auth = source.indexOf('supabase.auth.getUser');
    const configured = source.indexOf('isPayPalConfigured()');
    const paypalCall = source.indexOf('getSubscription(');
    const upsert = source.indexOf('.upsert(');

    expect(retired).toBeGreaterThan(-1);
    expect(retired).toBeLessThan(auth);
    expect(retired).toBeLessThan(configured);
    expect(retired).toBeLessThan(paypalCall);
    expect(retired).toBeLessThan(upsert);
  });

  it('returns a typed "retired" outcome rather than a success shape', async () => {
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
    vi.doMock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }));
    const { verifyPayPalSubscriptionAction } =
      await import('@/features/billing/providers/paypal/verify-action');
    const result = await verifyPayPalSubscriptionAction('I-ABCDEF123', 'pro', 'monthly');
    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('retired');
    expect(result.message).toBe(SUBSCRIPTIONS_RETIRED_MESSAGE);
    // No tier is ever handed back.
    expect(result.tier).toBeUndefined();
  });
});
