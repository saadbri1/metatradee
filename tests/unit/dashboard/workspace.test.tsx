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
      <DashboardOverview name="Trader" data={data} />
    </QueryClientProvider>,
  );
}

/** The KPI card wrapper for a given widget id. */
function kpiCard(id: string): HTMLElement {
  return document.querySelector(`[data-widget-id="${id}"]`) as HTMLElement;
}

describe('reference Dashboard composition', () => {
  beforeEach(() => {
    actionMocks.createAccount.mockReset();
    actionMocks.createAccount.mockResolvedValue({ ok: true, id: 'account-3' });
    actionMocks.updateAccount.mockReset();
    actionMocks.refresh.mockReset();
    actionMocks.replace.mockReset();
  });

  it('renders the reference rows with honest empty states', () => {
    const { container } = renderDashboard();

    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();

    // The whole Dashboard is light-scoped so its content matches the light
    // reference regardless of the app's dark-first theme.
    expect(container.querySelector('.light.min-h-screen')).not.toBeNull();

    // Five KPI cards in one row.
    const kpis = container.querySelector('[data-dashboard-layout="kpis"]')!;
    expect(kpis).toHaveClass('xl:grid-cols-5');
    expect(kpis.querySelectorAll('[data-widget-id]')).toHaveLength(5);

    // Three analytics cards in one row.
    const analytics = container.querySelector('[data-dashboard-layout="analytics"]')!;
    expect(analytics).toHaveClass('xl:grid-cols-3');
    expect(analytics.querySelectorAll('[data-widget-id]')).toHaveLength(3);

    // Positions panel beside a wider calendar.
    const lower = container.querySelector('[data-dashboard-layout="lower"]')!;
    expect(lower.querySelectorAll('[data-widget-id]')).toHaveLength(2);
    expect(lower.querySelector('[data-widget-id="calendar"]')).toHaveClass('xl:col-span-2');

    expect(container.querySelectorAll('[data-dashboard-card="open-positions"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-dashboard-card="calendar"]')).toHaveLength(1);

    // Empty states stay honest rather than inventing values.
    expect(kpiCard('net-pnl')).toHaveTextContent('—');
    expect(screen.getByText(/Score unlocks with 20 closed trades/i)).toBeInTheDocument();
    expect(screen.getByText('No placeholder score is shown.')).toBeInTheDocument();
    expect(screen.getByText('No open positions')).toBeInTheDocument();
    expect(
      screen.getAllByRole('img', { name: 'No closed trades match these filters' }),
    ).toHaveLength(2);
  });

  it('keeps the compact header controls in the reference order', () => {
    renderDashboard();
    const controls = screen.getByLabelText('Dashboard controls');
    const balance = within(controls).getByLabelText('Tracked balance');
    const filters = within(controls).getByRole('button', { name: /^Filters$/ });
    const date = within(controls).getByRole('button', { name: /All time/i });
    const accounts = within(controls).getByRole('button', { name: /All accounts/i });
    const notifications = within(controls).getByRole('button', { name: /Notifications/i });
    const follows = (first: Element, second: Element) =>
      Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(follows(balance, filters)).toBe(true);
    expect(follows(filters, date)).toBe(true);
    expect(follows(date, accounts)).toBe(true);
    expect(follows(accounts, notifications)).toBe(true);
  });

  it('shows the greeting and the real action row', () => {
    renderDashboard();
    expect(screen.getByRole('heading', { level: 2, name: /Trader!$/ })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('No imports yet');
    expect(screen.getByRole('button', { name: /Edit widgets/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Import trades/i })).toHaveAttribute(
      'href',
      '/journal/import',
    );
  });

  it('renders every KPI from real projection data', () => {
    renderDashboard({
      ...emptyData,
      accounts: [account],
      trades: [
        trade({ id: 'win', net_pnl: 120 }),
        trade({ id: 'loss', net_pnl: -40, closed_at: '2026-01-11T15:00:00Z' }),
        trade({ id: 'flat', net_pnl: 0, closed_at: '2026-01-11T18:00:00Z' }),
      ],
    });

    // Net P&L: 120 - 40 + 0 across 3 closed trades.
    expect(kpiCard('net-pnl')).toHaveTextContent('$80.00');
    expect(kpiCard('net-pnl')).toHaveTextContent('3');
    // Expectancy: 80 / 3.
    expect(kpiCard('trade-expectancy')).toHaveTextContent('$26.67');
    // Profit factor: 120 / 40.
    expect(kpiCard('profit-factor')).toHaveTextContent('3');
    // Win %: 1 winner of 3 eligible closed trades.
    expect(kpiCard('win-rate')).toHaveTextContent('33.33%');
    expect(kpiCard('average-win-loss')).toHaveTextContent('$120.00');
    expect(kpiCard('average-win-loss')).toHaveTextContent('-$40.00');
  });

  it('documents break-even and timezone policies accessibly', async () => {
    renderDashboard();
    const buttons = screen.getAllByRole('button', { name: 'About this metric' });

    fireEvent.focus(buttons.find((button) => button.closest('[data-widget-id="win-rate"]'))!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/Break-even trades remain/i);
    fireEvent.blur(document.activeElement!);

    fireEvent.focus(buttons.find((button) => button.closest('[data-widget-id="daily-pnl"]'))!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/workspace timezone/i);
  });

  it('renders the cumulative and daily P&L charts as separate cards', () => {
    renderDashboard({ ...emptyData, accounts: [account], trades: [trade()] });

    expect(
      screen.getByRole('img', { name: /Daily cumulative realized profit and loss/i }),
    ).toBeVisible();
    expect(
      screen.getByRole('img', { name: /Realized net profit and loss by trading day/i }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Daily Net Cumulative P&L' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Net Daily P&L' })).toBeInTheDocument();
  });

  it('renders the MetaTradee Score only once enough closed trades exist', () => {
    const manyTrades = Array.from({ length: 20 }, (_, index) =>
      trade({
        id: `trade-${index}`,
        net_pnl: index % 2 === 0 ? 100 : -50,
        closed_at: `2026-01-${String((index % 27) + 1).padStart(2, '0')}T15:00:00Z`,
      }),
    );
    renderDashboard({ ...emptyData, accounts: [account], trades: manyTrades });

    expect(screen.queryByText(/Score unlocks with/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Your MetaTradee Score:/i)).toBeInTheDocument();
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
    expect(kpiCard('net-pnl')).toHaveTextContent('$70.00');

    await user.click(screen.getByRole('button', { name: /^Filters$/ }));
    await user.click(screen.getByRole('button', { name: 'Profitable' }));
    expect(kpiCard('net-pnl')).toHaveTextContent('$100.00');
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: /All accounts/i }));
    await user.click(screen.getByRole('checkbox', { name: /Funded evaluation/i }));
    expect(kpiCard('net-pnl')).toHaveTextContent('—');

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
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('shows compact open positions without pretending live prices exist', () => {
    renderDashboard({
      ...emptyData,
      accounts: [account],
      trades: [trade({ id: 'open', closed_at: null, net_pnl: null, exit_price: null })],
    });
    const panel = document.querySelector('[data-dashboard-card="open-positions"]') as HTMLElement;
    for (const heading of ['Open Date', 'Symbol', 'Unrealized P&L']) {
      expect(within(panel).getByRole('columnheader', { name: heading })).toBeInTheDocument();
    }
    expect(within(panel).getByText('ES')).toBeInTheDocument();
    expect(screen.getByLabelText('Unrealized P&L unavailable')).toBeInTheDocument();
  });

  it('switches to Recent Trades and shows real closed-trade values', async () => {
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

    for (const heading of ['Close Date', 'Symbol', 'Net P&L']) {
      expect(within(panel).getByRole('columnheader', { name: heading })).toBeInTheDocument();
    }
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
