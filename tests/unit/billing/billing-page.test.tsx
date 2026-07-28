/**
 * In-app billing page.
 *
 * The things that matter here are truthfulness about money and the absence of
 * retention dark patterns: the same prices as the public page, a plain
 * cancellation path, no hidden downgrade, and no claim that data is lost.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PLANS } from '@/features/billing/plans';
import { formatPrice, priceFor } from '@/features/billing/pricing';
import { resolveEntitlement } from '@/features/billing/entitlements';
import type { Entitlement } from '@/features/billing/types';

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

import { BillingPortal } from '@/features/billing/components/billing-portal';
import { PlansTable } from '@/features/billing/components/plans-table';

const FREE: Entitlement = resolveEntitlement(null);
const PRO: Entitlement = {
  tier: 'pro',
  features: PLANS.pro.features,
  limits: PLANS.pro.limits,
  status: 'active',
  inGracePeriod: false,
  endingAt: null,
};

function overview(partial: Partial<Parameters<typeof buildOverview>[0]> = {}) {
  return buildOverview({ entitlement: FREE, ...partial });
}
function buildOverview(o: {
  entitlement: Entitlement;
  invoices?: unknown[];
  usage?: { trades: number; accounts: number; playbooks: number };
  mock?: boolean;
}) {
  return {
    entitlement: o.entitlement,
    subscription: null,
    invoices: o.invoices ?? [],
    usage: o.usage ?? { trades: 12, accounts: 1, playbooks: 2 },
    mock: o.mock ?? false,
  };
}

beforeEach(() => {
  useBillingOverview.mockReset();
  useEntitlement.mockReset();
  useOpenPortal.mockReset();
  useCheckout.mockReset();
  useOpenPortal.mockReturnValue({ mutate: vi.fn(), isPending: false, data: undefined });
  useCheckout.mockReturnValue({ mutate: vi.fn(), isPending: false, data: undefined });
  useEntitlement.mockReturnValue({ data: FREE, isPending: false });
});

describe('the page tells the truth about the current plan', () => {
  it('names the plan and its real price', () => {
    useEntitlement.mockReturnValue({ data: PRO, isPending: false });
    useBillingOverview.mockReturnValue({
      data: overview({ entitlement: PRO }),
      isLoading: false,
    });
    render(<BillingPortal />);
    // "Pro" also appears in the plans grid below; assert the current-plan card.
    const current = screen.getByRole('region', { name: 'Current plan summary' });
    expect(within(current).getByText('Pro')).toBeInTheDocument();
    // Same figures as the public pricing page — one config, both surfaces.
    expect(
      screen.getByText(
        `${formatPrice(priceFor('pro').monthly)} per month, or ${formatPrice(priceFor('pro').annual)} billed yearly.`,
      ),
    ).toBeInTheDocument();
  });

  it('states that access continues and data survives when a plan is ending', () => {
    const ending: Entitlement = { ...PRO, endingAt: '2026-09-01T00:00:00.000Z' };
    useEntitlement.mockReturnValue({ data: ending, isPending: false });
    useBillingOverview.mockReturnValue({
      data: overview({ entitlement: ending }),
      isLoading: false,
    });
    render(<BillingPortal />);
    expect(screen.getByText(/moves to Free with all of your data intact/i)).toBeInTheDocument();
  });

  it('explains a failed payment without threatening immediate loss of access', () => {
    const pastDue: Entitlement = { ...PRO, status: 'past_due', inGracePeriod: true };
    useEntitlement.mockReturnValue({ data: pastDue, isPending: false });
    useBillingOverview.mockReturnValue({
      data: overview({ entitlement: pastDue }),
      isLoading: false,
    });
    render(<BillingPortal />);
    expect(screen.getByText(/still have full access/i)).toBeInTheDocument();
  });

  it('says demo mode plainly when no provider is configured', () => {
    useBillingOverview.mockReturnValue({
      data: overview({ mock: true }),
      isLoading: false,
    });
    render(<BillingPortal />);
    expect(screen.getByText(/no card is ever charged/i)).toBeInTheDocument();
  });
});

describe('usage is shown from real counts', () => {
  it('shows the actual count against the plan cap', () => {
    useBillingOverview.mockReturnValue({
      data: overview({ usage: { trades: 12, accounts: 1, playbooks: 2 } }),
      isLoading: false,
    });
    render(<BillingPortal />);
    // Free caps trades at 50.
    expect(screen.getByText('12 of 50')).toBeInTheDocument();
  });

  it('meters only the limits that actually exist on the plan', () => {
    // Pro is unlimited on trades and playbooks but capped at 10 accounts, so
    // exactly one meter should appear — showing a meter for an uncapped
    // resource would imply a limit the plan does not have.
    expect(PLANS.pro.limits.maxTrades).toBeNull();
    expect(PLANS.pro.limits.maxStrategies).toBeNull();
    expect(PLANS.pro.limits.maxAccounts).toBe(10);

    useEntitlement.mockReturnValue({ data: PRO, isPending: false });
    useBillingOverview.mockReturnValue({
      data: overview({ entitlement: PRO, usage: { trades: 4000, accounts: 2, playbooks: 9 } }),
      isLoading: false,
    });
    render(<BillingPortal />);
    const meters = screen.getAllByRole('progressbar');
    expect(meters).toHaveLength(1);
    expect(meters[0]).toHaveAttribute('aria-label', 'Trading accounts: 2 of 10 used');
  });

  it('shows no meters at all on a fully unlimited plan', () => {
    const funded: Entitlement = {
      tier: 'funded',
      features: PLANS.funded.features,
      limits: PLANS.funded.limits,
      status: 'active',
      inGracePeriod: false,
      endingAt: null,
    };
    useEntitlement.mockReturnValue({ data: funded, isPending: false });
    useBillingOverview.mockReturnValue({
      data: overview({ entitlement: funded, usage: { trades: 4000, accounts: 12, playbooks: 40 } }),
      isLoading: false,
    });
    render(<BillingPortal />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText(/no limits on trades, accounts or playbooks/i)).toBeInTheDocument();
  });
});

describe('no retention dark patterns', () => {
  it('offers cancellation as one plain link to the provider portal', () => {
    useBillingOverview.mockReturnValue({ data: overview(), isLoading: false });
    render(<BillingPortal />);
    expect(screen.getByRole('button', { name: /Manage billing & payment method/i })).toBeEnabled();
  });

  it('never claims data will be deleted', () => {
    useBillingOverview.mockReturnValue({ data: overview(), isLoading: false });
    const { container } = render(<BillingPortal />);
    expect(container.textContent).not.toMatch(/will be (deleted|erased|lost|removed)/i);
    expect(container.textContent).toMatch(/nothing you have recorded is deleted/i);
  });

  it('shows an empty invoice state rather than an empty table', () => {
    useBillingOverview.mockReturnValue({ data: overview(), isLoading: false });
    render(<BillingPortal />);
    expect(screen.getByText(/No invoices yet/i)).toBeInTheDocument();
  });
});

describe('plan switching is symmetrical', () => {
  it('offers a downgrade as plainly as an upgrade', () => {
    render(<PlansTable currentTier="pro" />);
    // Trader is cheaper than the current Pro — offered, not hidden.
    const trader = screen.getByLabelText('Trader plan');
    expect(within(trader).getByRole('button', { name: 'Switch to Trader' })).toBeEnabled();
    const funded = screen.getByLabelText('Funded plan');
    expect(within(funded).getByRole('button', { name: 'Choose Funded' })).toBeEnabled();
  });

  it('marks the current plan instead of disguising it as unavailable', () => {
    render(<PlansTable currentTier="pro" />);
    const pro = screen.getByLabelText('Pro plan');
    expect(within(pro).getByText('Current')).toBeInTheDocument();
    expect(within(pro).getByRole('button', { name: 'Current plan' })).toBeDisabled();
  });

  it('quotes the same prices as the public pricing page', async () => {
    const user = userEvent.setup();
    render(<PlansTable />);
    const pro = screen.getByLabelText('Pro plan');
    expect(within(pro).getByText(formatPrice(priceFor('pro').monthly))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Yearly' }));
    expect(within(pro).getByText(/\$390 billed yearly — save 17%/)).toBeInTheDocument();
  });

  it('does not list a capability the plan does not grant', () => {
    render(<PlansTable currentTier="free" />);
    // propFirmTools is false on every tier, so it appears on none of the cards.
    expect(screen.queryByText('Prop-firm tools')).not.toBeInTheDocument();
  });
});
