import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TradingAccount } from '@/features/accounts/types';
import type { DashboardData, DashboardTrade } from '@/features/dashboard/types';

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

const secondAccount: TradingAccount = {
  ...account,
  id: 'account-2',
  name: 'Funded evaluation',
  account_type: 'funded',
  is_default: false,
};

function trade(overrides: Partial<DashboardTrade> = {}): DashboardTrade {
  return {
    id: 'trade-1',
    net_pnl: 100,
    pnl: 100,
    rr_ratio: 2,
    quantity: 1,
    position_size: 1,
    risk_amount: 50,
    risk_percent: 0.5,
    direction: 'buy',
    symbol: 'ES',
    market: 'futures',
    asset_type: 'futures',
    session: 'new_york',
    strategy_id: null,
    broker_id: null,
    trading_account_id: account.id,
    source: 'manual',
    entry_price: 5000,
    exit_price: 5010,
    currency: 'USD',
    opened_at: '2026-01-10T14:00:00Z',
    closed_at: '2026-01-10T15:00:00Z',
    duration_seconds: 3600,
    notes: null,
    created_at: '2026-01-10T14:00:00Z',
    ...overrides,
  };
}

const emptyData: DashboardData = {
  accounts: [],
  trades: [],
  lastImportAt: null,
  lastImportStatus: null,
  timezone: 'UTC',
};

function renderDashboard(data: DashboardData = emptyData) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardOverview
        name="Trader"
        data={data}
        user={{
          displayName: 'Trader',
          username: 'trader',
          email: 'trader@example.com',
          avatarUrl: null,
        }}
      />
    </QueryClientProvider>,
  );
}

describe('professional Dashboard workspace', () => {
  beforeEach(() => {
    actionMocks.createAccount.mockReset();
    actionMocks.createAccount.mockResolvedValue({ ok: true, id: 'account-3' });
    actionMocks.updateAccount.mockReset();
    actionMocks.refresh.mockReset();
    actionMocks.replace.mockReset();
  });

  it('preserves the final reference geometry with honest empty states', () => {
    const { container } = renderDashboard();

    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByLabelText('Trade import status')).toHaveTextContent('No imports yet');
    expect(screen.getByLabelText('Performance summary')).toHaveTextContent('Total Net P&L—');
    expect(screen.getByLabelText('Performance summary')).toHaveTextContent('No closed trades');
    expect(container.querySelector('[data-dashboard-layout="performance-summary"]')).toHaveClass(
      'md:grid-cols-[minmax(0,1fr)_minmax(0,2.05fr)]',
    );
    expect(container.querySelector('[data-dashboard-layout="professional-analytics"]')).toHaveClass(
      'xl:grid-cols-[minmax(320px,0.92fr)_minmax(0,2.08fr)]',
    );
    expect(container.querySelectorAll('[data-dashboard-card="winning-trades"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-dashboard-card="winning-days"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-dashboard-card="pnl-workspace"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-dashboard-card="open-positions"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-dashboard-card="calendar"]')).toHaveLength(1);
    expect(screen.getAllByRole('img', { name: /No eligible data/ })).toHaveLength(2);
    expect(
      screen.getByRole('img', { name: 'No closed trades match these filters' }),
    ).toHaveAttribute('tabindex', '0');
    expect(screen.getByText('No open positions')).toBeInTheDocument();
  });

  it('keeps the compact header and removes controls that conflict with the fixed grid', () => {
    renderDashboard();
    const controls = screen.getByLabelText('Dashboard controls');
    const filters = within(controls).getByRole('button', { name: /^Filters$/ });
    const date = within(controls).getByRole('button', { name: /All time/i });
    const accounts = within(controls).getByRole('button', { name: /All accounts/i });
    const profile = within(controls).getByRole('button', { name: 'Account menu' });
    const follows = (first: Element, second: Element) =>
      Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(follows(filters, date)).toBe(true);
    expect(follows(date, accounts)).toBe(true);
    expect(follows(accounts, profile)).toBe(true);
    expect(screen.queryByRole('button', { name: /Edit widgets/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Notifications/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Import trades/i })).toHaveAttribute(
      'href',
      '/journal/import',
    );
  });

  it('renders the real summary formulas and distinct trade/day win rates', () => {
    renderDashboard({
      ...emptyData,
      accounts: [account],
      trades: [
        trade({ id: 'win', net_pnl: 120 }),
        trade({ id: 'loss', net_pnl: -40, closed_at: '2026-01-11T15:00:00Z' }),
        trade({ id: 'flat', net_pnl: 0, closed_at: '2026-01-11T18:00:00Z' }),
      ],
    });

    const summary = screen.getByLabelText('Performance summary');
    expect(summary).toHaveTextContent('$80.00');
    expect(summary).toHaveTextContent('3 closed trades');
    expect(summary).toHaveTextContent('3');
    expect(summary).toHaveTextContent('$120.00');
    expect(summary).toHaveTextContent('-$40.00');
    expect(
      screen.getByRole('img', { name: /Winning % by Trades.*33% win rate/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Winning % by Days.*50% win rate/i }),
    ).toBeInTheDocument();
  });

  it('documents break-even, flat-day, no-trade, and timezone policies accessibly', async () => {
    renderDashboard();
    const buttons = screen.getAllByRole('button', { name: 'About this metric' });
    fireEvent.focus(
      buttons.find((button) => button.closest('[data-dashboard-card="winning-trades"]'))!,
    );
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/Break-even trades remain/i);
    fireEvent.blur(document.activeElement!);
    fireEvent.focus(
      buttons.find((button) => button.closest('[data-dashboard-card="winning-days"]'))!,
    );
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/Flat days remain/i);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/no-trade days are excluded/i);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/workspace timezone/i);
  });

  it('switches the single P&L panel between cumulative and daily charts without duplication', async () => {
    const user = userEvent.setup();
    renderDashboard({ ...emptyData, accounts: [account], trades: [trade()] });

    expect(
      screen.getByRole('img', { name: /Daily cumulative realized profit and loss/i }),
    ).toBeVisible();
    expect(
      screen.queryByRole('img', { name: /Realized net profit and loss by trading day/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Net Daily P&L' }));
    expect(
      screen.getByRole('img', { name: /Realized net profit and loss by trading day/i }),
    ).toBeVisible();
    expect(
      screen.queryByRole('img', { name: /Daily cumulative realized profit and loss/i }),
    ).not.toBeInTheDocument();
  });

  it('applies the shared result, date, and account filters to every projection', async () => {
    const user = userEvent.setup();
    renderDashboard({
      ...emptyData,
      accounts: [account, secondAccount],
      trades: [
        trade({ id: 'primary-win', net_pnl: 100, trading_account_id: account.id }),
        trade({
          id: 'funded-loss',
          net_pnl: -30,
          trading_account_id: secondAccount.id,
          closed_at: '2026-01-11T15:00:00Z',
        }),
      ],
    });
    const summary = screen.getByLabelText('Performance summary');
    expect(summary).toHaveTextContent('$70.00');

    await user.click(screen.getByRole('button', { name: /^Filters$/ }));
    await user.click(screen.getByRole('button', { name: 'Profitable' }));
    expect(summary).toHaveTextContent('$100.00');
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: /All accounts/i }));
    await user.click(screen.getByRole('checkbox', { name: /Funded evaluation/i }));
    expect(summary).toHaveTextContent('No closed trades');

    await user.click(screen.getByRole('button', { name: /All time/i }));
    await user.click(screen.getByRole('button', { name: 'This month' }));
    expect(screen.getByRole('button', { name: /This month/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  }, 10_000);

  it('opens the real Add account workflow and returns focus after Escape', async () => {
    const user = userEvent.setup();
    renderDashboard();
    const trigger = screen.getByRole('button', { name: 'Add account' });
    trigger.focus();
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toHaveTextContent('Add a trading account');
    expect(screen.getByRole('radio', { name: /Broker account/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Demo account/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Funded account/i })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('shows complete open-position fields without pretending live prices exist', () => {
    renderDashboard({
      ...emptyData,
      accounts: [account],
      trades: [trade({ id: 'open', closed_at: null, net_pnl: null, exit_price: null })],
    });
    for (const heading of [
      'Opened',
      'Account',
      'Symbol',
      'Side',
      'Quantity',
      'Average entry',
      'Latest price',
      'Unrealized P&L',
    ]) {
      expect(screen.getByRole('columnheader', { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText('Primary broker')).toBeInTheDocument();
    expect(screen.getByLabelText('Latest price unavailable')).toBeInTheDocument();
    expect(screen.getByLabelText('Unrealized P&L unavailable')).toBeInTheDocument();
  });

  it('switches to Recent Trades and shows real closed-trade fields', async () => {
    const user = userEvent.setup();
    renderDashboard({
      ...emptyData,
      accounts: [account],
      trades: [
        trade({ id: 'open', closed_at: null, net_pnl: null, exit_price: null }),
        trade({ id: 'closed', net_pnl: 250 }),
      ],
    });

    const panel = document.querySelector('[data-dashboard-card="open-positions"]') as HTMLElement;
    await user.click(within(panel).getByRole('tab', { name: /Recent Trades/i }));

    for (const heading of ['Closed', 'Account', 'Symbol', 'Side', 'Quantity', 'Net P&L']) {
      expect(within(panel).getByRole('columnheader', { name: heading })).toBeInTheDocument();
    }
    // The closed trade is listed with its real realized P&L; the open one is not.
    expect(within(panel).getByText('$250.00')).toBeInTheDocument();
  });

  it('navigates calendar months and applies a populated day as a real date filter', async () => {
    const user = userEvent.setup();
    renderDashboard({ ...emptyData, accounts: [account], trades: [trade()] });
    expect(screen.getByRole('heading', { name: 'January 2026' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('heading', { name: 'December 2025' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    await user.click(screen.getByRole('button', { name: /2026-01-10/ }));
    expect(screen.getByRole('button', { name: /Custom range/i })).toBeInTheDocument();
  });

  it('opens the real profile menu destinations', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/settings/profile',
    );
    expect(screen.getByRole('menuitem', { name: 'Preferences' })).toHaveAttribute(
      'href',
      '/settings/preferences',
    );
    expect(screen.getByRole('menuitem', { name: 'Billing' })).toHaveAttribute('href', '/billing');
  });

  it('renders route loading and retryable error states', () => {
    const { unmount } = render(<DashboardLoading />);
    expect(screen.getByLabelText('Loading dashboard')).toHaveAttribute('aria-busy', 'true');
    unmount();
    const reset = vi.fn();
    render(<DashboardError error={new Error('network')} reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
