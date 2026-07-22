import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TradingAccount } from '@/features/accounts/types';

const actionMocks = vi.hoisted(() => ({
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: actionMocks.refresh, replace: actionMocks.replace }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/features/accounts/server/actions', () => ({
  createTradingAccountAction: actionMocks.createAccount,
  updateTradingAccountStatusAction: actionMocks.updateAccount,
}));

import { DashboardOverview } from '@/features/dashboard/components/dashboard-overview';
import DashboardLoading from '@/app/(protected)/dashboard/loading';
import DashboardError from '@/app/(protected)/dashboard/error';

const emptyData = {
  accounts: [],
  trades: [],
  lastImportAt: null,
  lastImportStatus: null,
  timezone: 'UTC',
};

const account: TradingAccount = {
  id: 'account-1',
  user_id: 'user-1',
  name: 'Primary broker',
  account_type: 'broker',
  provider: 'File provider',
  external_account_identifier: null,
  base_currency: 'USD',
  starting_balance: 10_000,
  account_size: null,
  status: 'active',
  connection_method: 'file',
  import_status: 'ready',
  last_successful_import_at: null,
  is_default: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('account-aware dashboard workspace', () => {
  beforeEach(() => {
    actionMocks.createAccount.mockReset();
    actionMocks.createAccount.mockResolvedValue({ ok: true, id: 'account-2' });
    actionMocks.updateAccount.mockReset();
    actionMocks.refresh.mockReset();
    actionMocks.replace.mockReset();
  });

  it('renders the compact parity layout with honest empty data', () => {
    const { container } = render(<DashboardOverview name="Trader" data={emptyData} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText(/Good (morning|afternoon|evening), Trader/)).toBeInTheDocument();
    expect(screen.queryByText(/Start with a real account container/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Tracked balance')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Tracked balance summary')).toHaveTextContent('—');

    const kpiLayout = container.querySelector('[data-dashboard-layout="kpis"]');
    const analyticsLayout = container.querySelector('[data-dashboard-layout="analytics"]');
    const lowerLayout = container.querySelector('[data-dashboard-layout="lower"]');
    expect(kpiLayout).toHaveClass('xl:grid-cols-5');
    expect(analyticsLayout).toHaveClass('xl:grid-cols-3');
    expect(lowerLayout).toHaveClass('xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]');
    expect(container.querySelectorAll('[data-dashboard-card="kpi"]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-dashboard-card="analytics"]')).toHaveLength(3);

    for (const label of [
      'Net P&L',
      'Trade expectancy',
      'Profit factor',
      'Win rate',
      'Average win/loss trade',
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/Score unlocks with 20 closed trades/i)).toBeInTheDocument();
    expect(screen.getAllByText(/No closed trades match these filters/i)).toHaveLength(2);
    expect(screen.getByText('No open positions')).toBeInTheDocument();
  });

  it('keeps the desktop header controls in reference order and removes redundant controls', () => {
    render(<DashboardOverview name="Trader" data={emptyData} />);

    const controls = screen.getByLabelText('Dashboard controls');
    const balance = within(controls).getByLabelText('Tracked balance summary');
    const filters = within(controls).getByRole('button', { name: /^Filters$/ });
    const date = within(controls).getByRole('button', { name: /All time/i });
    const accounts = within(controls).getByRole('button', { name: /All accounts/i });
    const notifications = within(controls).getByRole('button', {
      name: 'Notifications unavailable',
    });
    const follows = (first: Element, second: Element) =>
      Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(follows(balance, filters)).toBe(true);
    expect(follows(filters, date)).toBe(true);
    expect(follows(date, accounts)).toBe(true);
    expect(follows(accounts, notifications)).toBe(true);
    expect(screen.queryByRole('button', { name: /search/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit widgets/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(notifications).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('link', { name: /import trades/i })).toHaveAttribute(
      'href',
      '/journal/import',
    );
  });

  it('keeps filters, date range, and account selection connected to shared state', async () => {
    const user = userEvent.setup();
    render(<DashboardOverview name="Trader" data={{ ...emptyData, accounts: [account] }} />);

    await user.click(screen.getByRole('button', { name: /^Filters$/ }));
    await user.click(screen.getByRole('button', { name: 'Profitable' }));
    expect(screen.getByRole('button', { name: /Filters 1/i })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /Filters 1/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await user.click(screen.getByRole('button', { name: /Filters 1/i }));
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('button', { name: /^Filters$/ })).toBeInTheDocument();
    await user.click(screen.getByText(/Good (morning|afternoon|evening), Trader/));
    expect(screen.getByRole('button', { name: /^Filters$/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await user.click(screen.getByRole('button', { name: /All time/i }));
    await user.click(screen.getByRole('button', { name: 'This month' }));
    expect(screen.getByRole('button', { name: /This month/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await user.click(screen.getByRole('button', { name: /All accounts/i }));
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: /Primary broker/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Manage accounts/i }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Manage trading accounts');
    await user.click(screen.getByRole('button', { name: 'Close' }));
  }, 10_000);

  it('explains unavailable controls on keyboard focus without opening fake surfaces', async () => {
    const user = userEvent.setup();
    render(<DashboardOverview name="Trader" data={emptyData} />);

    const editWidgets = screen.getByRole('button', { name: /edit widgets/i });
    fireEvent.focus(editWidgets);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Widget customization is not available yet.',
    );
    await user.click(editWidgets);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const notifications = screen.getByRole('button', { name: 'Notifications unavailable' });
    fireEvent.focus(notifications);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Notifications are not available yet.',
    );
    await user.click(notifications);
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();
  });

  it('opens, closes, validates, and submits the real three-path account workflow once', async () => {
    const user = userEvent.setup();
    render(<DashboardOverview name="Trader" data={emptyData} />);
    const trigger = screen.getByRole('button', { name: /add account/i });
    trigger.focus();
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Broker account')).toBeInTheDocument();
    expect(screen.getByText('Demo account')).toBeInTheDocument();
    expect(screen.getByText('Funded account')).toBeInTheDocument();
    expect(screen.getByText(/Live OAuth\/API synchronization is coming soon/i)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Demo account/i }));
    expect(screen.getByText(/Demo balances are deterministic/i)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Funded account/i }));
    expect(screen.getByLabelText('Account size')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    expect(screen.getByRole('radio', { name: /Broker account/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
    await user.type(screen.getByLabelText('Account name'), 'Evaluation 100K');
    const create = screen.getByRole('button', { name: 'Create account' });
    let finishCreate!: (result: { ok: true; id: string }) => void;
    actionMocks.createAccount.mockReturnValueOnce(
      new Promise((resolve) => {
        finishCreate = resolve;
      }),
    );
    fireEvent.click(create);
    fireEvent.click(create);
    await waitFor(() => expect(actionMocks.createAccount).toHaveBeenCalledOnce());
    finishCreate({ ok: true, id: 'account-2' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(actionMocks.refresh).toHaveBeenCalledOnce();
  }, 10_000);

  it('exposes the real KPI formulas and keyboard chart summaries', async () => {
    render(<DashboardOverview name="Trader" data={emptyData} />);

    const metricInfo = screen.getAllByRole('button', { name: 'About this metric' })[0]!;
    fireEvent.focus(metricInfo);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Realized net P&L from closed trades after recorded fees.',
    );
    expect(
      screen.getAllByRole('img', { name: 'No closed trades match these filters' }),
    ).toHaveLength(2);
    for (const chart of screen.getAllByRole('img', {
      name: 'No closed trades match these filters',
    })) {
      expect(chart).toHaveAttribute('tabindex', '0');
    }
  });

  it('switches between the compact table tabs without hiding table structure', async () => {
    const user = userEvent.setup();
    render(<DashboardOverview name="Trader" data={emptyData} />);

    expect(screen.getByRole('columnheader', { name: 'Opened' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Recent trades' }));
    expect(screen.getByRole('columnheader', { name: 'Closed' })).toBeInTheDocument();
    expect(screen.getByText('No recent closed trades')).toBeInTheDocument();
  });

  it('renders route loading and retryable error states in the compact geometry', () => {
    const { unmount } = render(<DashboardLoading />);
    expect(screen.getByLabelText('Loading dashboard')).toHaveAttribute('aria-busy', 'true');
    unmount();
    const reset = vi.fn();
    render(<DashboardError error={new Error('network')} reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
