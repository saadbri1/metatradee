/**
 * The reusable lock UI kit.
 *
 * These components never decide access — the server does. What they must get
 * right is (a) failing closed while access is unknown, (b) never naming a plan
 * that does not actually grant the feature, and (c) keeping the reason
 * reachable by assistive tech instead of silently hiding a control.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PLANS } from '@/features/billing/plans';
import { resolveEntitlement } from '@/features/billing/entitlements';
import type { Entitlement } from '@/features/billing/types';

const useEntitlement = vi.fn();
vi.mock('@/features/billing/hooks', () => ({
  useEntitlement: () => useEntitlement(),
}));

import {
  EntitlementGate,
  LockedFeature,
  LockedAction,
  PlanBadge,
  RequiresPlan,
  UsageLimit,
} from '@/features/billing/components/entitlement-ui';

const FREE: Entitlement = resolveEntitlement(null);
const PRO: Entitlement = {
  tier: 'pro',
  features: PLANS.pro.features,
  limits: PLANS.pro.limits,
  status: 'active',
  inGracePeriod: false,
  endingAt: null,
};

function resolved(ent: Entitlement | null) {
  useEntitlement.mockReturnValue({ data: ent, isPending: false });
}
function loading() {
  useEntitlement.mockReturnValue({ data: undefined, isPending: true });
}

beforeEach(() => {
  useEntitlement.mockReset();
});

describe('EntitlementGate fails closed', () => {
  it('shows gated content only to an entitled viewer', () => {
    resolved(PRO);
    render(
      <EntitlementGate feature="aiCoach">
        <p>coach</p>
      </EntitlementGate>,
    );
    expect(screen.getByText('coach')).toBeInTheDocument();
  });

  it('shows the fallback, not the content, to an unentitled viewer', () => {
    resolved(FREE);
    render(
      <EntitlementGate feature="aiCoach" fallback={<p>locked</p>}>
        <p>coach</p>
      </EntitlementGate>,
    );
    expect(screen.queryByText('coach')).not.toBeInTheDocument();
    expect(screen.getByText('locked')).toBeInTheDocument();
  });

  it('renders nothing while access is still unknown — no optimistic flash', () => {
    loading();
    const { container } = render(
      <EntitlementGate feature="aiCoach" fallback={<p>locked</p>}>
        <p>coach</p>
      </EntitlementGate>,
    );
    expect(screen.queryByText('coach')).not.toBeInTheDocument();
    expect(container.textContent).toBe('');
  });

  it('treats an unresolved entitlement as no access', () => {
    resolved(null);
    render(
      <EntitlementGate feature="aiCoach">
        <p>coach</p>
      </EntitlementGate>,
    );
    expect(screen.queryByText('coach')).not.toBeInTheDocument();
  });
});

describe('upsells name only a plan that really grants the feature', () => {
  it('names the cheapest granting tier', () => {
    resolved(FREE);
    render(<RequiresPlan feature="aiCoach" />);
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('renders nothing for a capability no plan grants, rather than inventing one', () => {
    resolved(FREE);
    const { container } = render(<RequiresPlan feature="propFirmTools" />);
    expect(container.textContent).toBe('');
  });

  it('LockedFeature offers an upgrade only when one exists', () => {
    resolved(FREE);
    const { rerender } = render(
      <LockedFeature feature="brokerImport" title="Import is paid" description="Import fills." />,
    );
    expect(screen.getByRole('link', { name: /Upgrade to Trader/ })).toHaveAttribute(
      'href',
      '/billing',
    );

    rerender(
      <LockedFeature feature="propFirmTools" title="Prop tools" description="Not built yet." />,
    );
    expect(screen.queryByRole('link', { name: /Upgrade/ })).not.toBeInTheDocument();
    expect(screen.getByText('Not available yet.')).toBeInTheDocument();
  });
});

describe('a locked control explains itself instead of disappearing', () => {
  it('stays focusable and names the required plan accessibly', async () => {
    resolved(FREE);
    render(
      <LockedAction
        feature="reportsExport"
        label="Export"
        title="Exporting reports is a paid feature"
        description="Download as CSV, JSON or PDF."
      />,
    );
    const button = screen.getByRole('button', { name: /requires Trader/i });
    expect(button).toBeEnabled();
  });

  it('opens the explanation only when the user presses it', async () => {
    resolved(FREE);
    const user = userEvent.setup();
    render(
      <LockedAction
        feature="reportsExport"
        label="Export"
        title="Exporting reports is a paid feature"
        description="Download as CSV, JSON or PDF."
      />,
    );
    // Not shown on mount — no interstitial, no timer.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /requires Trader/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Exporting reports is a paid feature');
    // States the real configured price, from the central config.
    expect(dialog).toHaveTextContent('$19');
    expect(dialog).toHaveTextContent('$190');
  });
});

describe('UsageLimit', () => {
  it('states the count in text, not by colour alone', () => {
    resolved(FREE);
    render(<UsageLimit limitKey="maxTrades" current={12} label="Trades" />);
    expect(screen.getByText('12 of 50')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '12');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '50');
  });

  it('surfaces an upgrade path once the cap is reached', () => {
    resolved(FREE);
    render(<UsageLimit limitKey="maxTrades" current={50} label="Trades" />);
    expect(screen.getByRole('link', { name: /Compare plans/ })).toBeInTheDocument();
  });

  it('shows no meter at all on an unlimited plan', () => {
    resolved(PRO);
    const { container } = render(<UsageLimit limitKey="maxTrades" current={9999} label="Trades" />);
    expect(container.textContent).toBe('');
  });
});

describe('PlanBadge', () => {
  it('shows the resolved plan name', () => {
    resolved(PRO);
    render(<PlanBadge />);
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('renders nothing rather than guessing when the plan is unknown', () => {
    resolved(null);
    const { container } = render(<PlanBadge />);
    expect(container.textContent).toBe('');
  });
});
