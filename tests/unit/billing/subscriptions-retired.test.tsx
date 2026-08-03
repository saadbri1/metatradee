/**
 * PayPal Subscriptions is gone, not merely switched off.
 *
 * It was previously disabled behind a compile-time constant, because the
 * one-time Orders replacement was unfinished and deleting the modules would
 * have left no checkout at all. Orders now works end to end against the PayPal
 * Sandbox, so the old flow has been DELETED — and these tests changed shape
 * with it: they used to assert a kill switch was off, and now they assert
 * there is nothing left to switch.
 *
 * Absence is the stronger guarantee. A constant can be flipped; a module that
 * does not exist cannot create a subscription however the code around it
 * changes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

const SRC = resolve(__dirname, '../../../src');

beforeEach(() => {
  useOpenPortal.mockReturnValue({ mutate: vi.fn(), isPending: false, data: undefined });
  useCheckout.mockReturnValue({ mutate: vi.fn(), isPending: false, data: undefined });
});

describe('the subscription modules no longer exist', () => {
  it.each([
    'features/billing/providers/paypal/subscriptions-disabled.ts',
    'features/billing/providers/paypal/verify-action.ts',
    'features/billing/components/paypal-button.tsx',
    'features/billing/providers/paypal/browser-diagnostics.ts',
  ])('%s is deleted', (relative) => {
    expect(existsSync(resolve(SRC, relative))).toBe(false);
  });

  it('nothing in the source imports them', () => {
    /*
     * A dangling import would be a build error, but a dangling STRING — a lazy
     * import, a comment promising a file that is gone — would not be. This
     * catches both.
     */
    const files = [
      'features/billing/components/plans-table.tsx',
      'features/billing/components/paypal-pay-button.tsx',
      'features/billing/components/billing-portal.tsx',
      'features/billing/providers/paypal/order-actions.ts',
      'features/billing/server/paypal-config-action.ts',
      'features/billing/server/queries.ts',
    ];
    for (const relative of files) {
      const source = readFileSync(resolve(SRC, relative), 'utf8');
      expect(source, relative).not.toContain('subscriptions-disabled');
      expect(source, relative).not.toContain('verify-action');
      expect(source, relative).not.toContain('PayPalSubscribeButton');
    }
  });
});

describe('no surface can start a subscription', () => {
  it('renders no subscribe control on any paid tier', () => {
    render(<PlansTable />);
    for (const label of ['Trader plan', 'Pro plan', 'Funded plan']) {
      const card = screen.getByLabelText(label);
      expect(within(card).queryByRole('button', { name: /subscribe/i })).not.toBeInTheDocument();
      expect(within(card).queryByText(/subscribe/i)).not.toBeInTheDocument();
    }
  });

  it('uses no subscription or trial wording anywhere in the checkout', () => {
    const { container } = render(<PlansTable />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/subscri/i);
    expect(text).not.toMatch(/trial/i);
    expect(text).not.toMatch(/cancel any time/i);
    expect(text).toMatch(/no automatic renewal/i);
  });
});

describe('the checkout that remains is one-time Orders', () => {
  const button = readFileSync(
    resolve(SRC, 'features/billing/components/paypal-pay-button.tsx'),
    'utf8',
  );

  it('loads the SDK for capture, never for subscriptions', () => {
    /*
     * Scoped to the URLSearchParams literal. Matching the whole file for
     * 'vault' hits the word "vaulting" in a comment — and would keep passing
     * if a real `vault: 'true'` were added right beside it.
     */
    const start = button.indexOf('new URLSearchParams({');
    const params = button
      .slice(start, button.indexOf('});', start))
      // Comments stripped too: the block's own comment says "not subscription"
      // and "no vaulting", which a naive substring match reads as the opposite
      // of what it means.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(params).toContain("intent: 'capture'");
    expect(params).not.toContain('subscription');
    expect(params).not.toContain('vault');
  });

  it('creates orders rather than subscriptions', () => {
    expect(button).toContain('createOrder:');
    expect(button).not.toContain('createSubscription');
    expect(button).not.toContain('plan_id');
  });

  it('carries no leftover verification diagnostics', () => {
    // The sandbox capture is verified; the temporary instrumentation is gone.
    expect(button).not.toContain('ppBrowserDiag');
    const actions = readFileSync(
      resolve(SRC, 'features/billing/providers/paypal/order-actions.ts'),
      'utf8',
    );
    expect(actions).not.toContain('ppDiag');
  });
});
