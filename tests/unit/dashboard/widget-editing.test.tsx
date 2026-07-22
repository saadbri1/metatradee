import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TradingAccount } from '@/features/accounts/types';
import type { DashboardData, DashboardTrade } from '@/features/dashboard/types';

const actionMocks = vi.hoisted(() => ({
  saveLayout: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: actionMocks.refresh, replace: actionMocks.replace }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/features/accounts/server/actions', () => ({
  createTradingAccountAction: actionMocks.createAccount,
  updateTradingAccountStatusAction: actionMocks.updateAccount,
}));
vi.mock('@/features/dashboard/server/actions', () => ({
  saveDashboardWidgetLayoutAction: actionMocks.saveLayout,
}));

import { DashboardOverview } from '@/features/dashboard/components/dashboard-overview';
import {
  DEFAULT_DASHBOARD_WIDGET_LAYOUT,
  type DashboardWidgetLayout,
} from '@/features/dashboard/widget-preferences';

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

const data: DashboardData = {
  accounts: [account],
  trades: [trade(), trade({ id: 'open', closed_at: null, net_pnl: null, exit_price: null })],
  lastImportAt: null,
  lastImportStatus: null,
  timezone: 'UTC',
};

function renderDashboard(initialWidgetLayout?: DashboardWidgetLayout) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardOverview
        name="Trader"
        data={data}
        initialWidgetLayout={initialWidgetLayout}
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

/** Visible widget ids in document order, from the stable frame wrappers. */
function visibleWidgetOrder(): string[] {
  return Array.from(document.querySelectorAll('[data-widget-id]')).map(
    (node) => node.getAttribute('data-widget-id') as string,
  );
}

async function enterEditMode(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Edit widgets/i }));
  expect(await screen.findByText('Editing dashboard')).toBeInTheDocument();
}

describe('Dashboard widget editing', () => {
  beforeEach(() => {
    actionMocks.saveLayout.mockReset();
    actionMocks.saveLayout.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the Edit widgets action on the Dashboard', () => {
    renderDashboard();
    expect(screen.getByRole('button', { name: /Edit widgets/i })).toBeVisible();
    // Editing chrome stays out of the way until it is requested.
    expect(screen.queryByText('Editing dashboard')).not.toBeInTheDocument();
  });

  it('enters a real editing mode with Save, Cancel, and Restore defaults', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await enterEditMode(user);

    expect(screen.getByRole('button', { name: /Save changes/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^Cancel$/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Restore defaults/i })).toBeEnabled();
    expect(screen.getByRole('region', { name: 'Dashboard widget editor' })).toBeInTheDocument();
    // Editing state is conveyed structurally, not by colour alone.
    expect(document.querySelector('[data-widget-editing="true"]')).not.toBeNull();
  });

  it('hides a widget and offers it back from Available widgets', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await enterEditMode(user);

    expect(visibleWidgetOrder()).toContain('calendar');
    await user.click(screen.getByRole('button', { name: 'Hide Trading Calendar' }));

    expect(visibleWidgetOrder()).not.toContain('calendar');
    expect(screen.getByText(/Trading Calendar hidden/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Trading Calendar' })).toBeVisible();
  });

  it('restores a hidden widget from Available widgets', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await enterEditMode(user);

    await user.click(screen.getByRole('button', { name: 'Hide Trading Calendar' }));
    await user.click(screen.getByRole('button', { name: 'Show Trading Calendar' }));

    expect(visibleWidgetOrder()).toContain('calendar');
    expect(screen.getByText('All Dashboard widgets are visible.')).toBeInTheDocument();
  });

  it('moves a widget up and down within its region', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await enterEditMode(user);

    expect(visibleWidgetOrder()).toEqual([
      'performance-summary',
      'winning-trades',
      'winning-days',
      'positions',
      'pnl-workspace',
      'calendar',
    ]);

    await user.click(screen.getByRole('button', { name: 'Move Winning % by Days up' }));
    expect(visibleWidgetOrder().slice(1, 3)).toEqual(['winning-days', 'winning-trades']);
    expect(screen.getByText(/Winning % by Days moved up/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Move Winning % by Days down' }));
    expect(visibleWidgetOrder().slice(1, 3)).toEqual(['winning-trades', 'winning-days']);
  });

  it('disables move controls at the first and last position of a region', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await enterEditMode(user);

    expect(screen.getByRole('button', { name: 'Move Winning % by Trades up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Trading Calendar down' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Winning % by Trades down' })).toBeEnabled();
  });

  it('disables Hide on the last visible widget with an accessible reason', async () => {
    const user = userEvent.setup();
    renderDashboard({
      ...DEFAULT_DASHBOARD_WIDGET_LAYOUT,
      hidden: ['winning-trades', 'winning-days', 'positions', 'pnl-workspace', 'calendar'],
    });
    await enterEditMode(user);

    const hide = screen.getByRole('button', {
      name: 'Performance summary cannot be hidden because it is the last visible widget',
    });
    expect(hide).toBeDisabled();
  });

  it('saves the layout through the real server action and exits edit mode', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await enterEditMode(user);

    await user.click(screen.getByRole('button', { name: 'Hide Trading Calendar' }));
    await user.click(screen.getByRole('button', { name: /Save changes/i }));

    await waitFor(() => expect(actionMocks.saveLayout).toHaveBeenCalledTimes(1));
    expect(actionMocks.saveLayout).toHaveBeenCalledWith({
      ...DEFAULT_DASHBOARD_WIDGET_LAYOUT,
      hidden: ['calendar'],
    });

    await waitFor(() => expect(screen.queryByText('Editing dashboard')).not.toBeInTheDocument());
    expect(screen.getByText('Dashboard widget changes saved.')).toBeInTheDocument();
    // The saved layout is what the Dashboard now renders.
    expect(visibleWidgetOrder()).not.toContain('calendar');
  });

  it('surfaces a real error and stays in edit mode when the save fails', async () => {
    actionMocks.saveLayout.mockResolvedValue({ ok: false, error: 'Could not save.' });
    const user = userEvent.setup();
    renderDashboard();
    await enterEditMode(user);

    await user.click(screen.getByRole('button', { name: 'Hide Trading Calendar' }));
    await user.click(screen.getByRole('button', { name: /Save changes/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save.');
    expect(screen.getByText('Editing dashboard')).toBeInTheDocument();
  });

  it('cancel restores the exact previous layout and writes nothing', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderDashboard();
    const before = visibleWidgetOrder();
    await enterEditMode(user);

    await user.click(screen.getByRole('button', { name: 'Hide Trading Calendar' }));
    await user.click(screen.getByRole('button', { name: 'Move Winning % by Days up' }));
    expect(visibleWidgetOrder()).not.toEqual(before);

    await user.click(screen.getByRole('button', { name: /^Cancel$/i }));

    expect(visibleWidgetOrder()).toEqual(before);
    expect(actionMocks.saveLayout).not.toHaveBeenCalled();
    expect(screen.queryByText('Editing dashboard')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard changes cancelled.')).toBeInTheDocument();
  });

  it('restore defaults returns the documented order but stays unsaved until Save', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderDashboard({
      ...DEFAULT_DASHBOARD_WIDGET_LAYOUT,
      order: [
        'performance-summary',
        'winning-days',
        'winning-trades',
        'positions',
        'calendar',
        'pnl-workspace',
      ],
      hidden: ['positions'],
    });
    await enterEditMode(user);

    await user.click(screen.getByRole('button', { name: /Restore defaults/i }));

    expect(visibleWidgetOrder()).toEqual(DEFAULT_DASHBOARD_WIDGET_LAYOUT.order);
    expect(screen.getByText(/Save changes to keep it/i)).toBeInTheDocument();
    // Nothing is persisted until the user explicitly saves.
    expect(actionMocks.saveLayout).not.toHaveBeenCalled();
    expect(screen.getByText('Editing dashboard')).toBeInTheDocument();
  });

  it('renders a persisted order and visibility exactly as read from the server', () => {
    // Stands in for the next page load after a save.
    renderDashboard({
      ...DEFAULT_DASHBOARD_WIDGET_LAYOUT,
      order: [
        'performance-summary',
        'positions',
        'winning-days',
        'winning-trades',
        'calendar',
        'pnl-workspace',
      ],
      hidden: ['winning-trades'],
    });

    expect(visibleWidgetOrder()).toEqual([
      'performance-summary',
      'positions',
      'winning-days',
      'calendar',
      'pnl-workspace',
    ]);
    expect(screen.queryByRole('button', { name: /Edit widgets/i })).toBeVisible();
  });

  it('preserves account, filter, and widget tab state while editing', async () => {
    const user = userEvent.setup();
    renderDashboard();

    // Move the positions panel to its Recent Trades tab first.
    const positions = document.querySelector(
      '[data-dashboard-card="open-positions"]',
    ) as HTMLElement;
    await user.click(within(positions).getByRole('tab', { name: /Recent Trades/i }));
    expect(within(positions).getByRole('tab', { name: /Recent Trades/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await enterEditMode(user);

    // Entering edit mode must not remount the widget or reset its tab.
    const positionsAfter = document.querySelector(
      '[data-dashboard-card="open-positions"]',
    ) as HTMLElement;
    expect(within(positionsAfter).getByRole('tab', { name: /Recent Trades/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // The account selector and filter bar are untouched by editing.
    expect(screen.getByRole('button', { name: /All accounts/i })).toBeInTheDocument();
  });

  it('supports keyboard entry into edit mode and keyboard widget controls', async () => {
    const user = userEvent.setup();
    renderDashboard();

    const editButton = screen.getByRole('button', { name: /Edit widgets/i });
    editButton.focus();
    expect(editButton).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Editing dashboard')).toBeInTheDocument();

    // Every widget control is a real focusable button reachable by keyboard.
    const hide = screen.getByRole('button', { name: 'Hide Trading Calendar' });
    hide.focus();
    expect(hide).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(visibleWidgetOrder()).not.toContain('calendar');

    const show = screen.getByRole('button', { name: 'Show Trading Calendar' });
    show.focus();
    await user.keyboard(' ');
    expect(visibleWidgetOrder()).toContain('calendar');
  });

  it('keeps every editing control reachable at a mobile viewport', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await enterEditMode(user);

    // The toolbar stacks rather than hiding controls on small screens.
    const toolbar = screen.getByRole('region', { name: 'Dashboard widget editor' });
    expect(toolbar.className).toContain('flex-col');
    for (const name of [/Save changes/i, /^Cancel$/i, /Restore defaults/i]) {
      expect(within(toolbar).getByRole('button', { name })).toBeVisible();
    }
    expect(screen.getByRole('button', { name: 'Hide Trading Calendar' })).toBeVisible();
  });
});
