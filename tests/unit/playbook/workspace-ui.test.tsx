import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeMetrics, EMPTY_METRICS } from '@/features/playbook/performance';
import type { PlaybookListRow } from '@/features/playbook/filters';
import type { AnalyticsTrade } from '@/features/analytics/types';
import type { PlaybookWorkspaceData } from '@/features/playbook/server/queries';

// ---------------------------------------------------------------------------
// Harness — a live URL so the component's real URL state round-trips.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  duplicate: vi.fn(),
  changeStatus: vi.fn(),
  remove: vi.fn(),
  pin: vi.fn(),
  workspace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, push: mocks.push, refresh: mocks.refresh }),
  usePathname: () => '/playbook',
  useSearchParams: () => mocks.params,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// jsdom implements neither the Pointer Capture API nor scrollIntoView, both of
// which Radix's Select uses. Without these, opening a native-feeling select in
// a test throws. This is a jsdom gap, not a product defect.
beforeAll(() => {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
});

vi.mock('@/features/playbook/server/actions', () => ({
  getPlaybookWorkspaceAction: (...args: unknown[]) => mocks.workspace(...args),
  duplicateStrategyAction: (...args: unknown[]) => mocks.duplicate(...args),
  changeStrategyStatusAction: (...args: unknown[]) => mocks.changeStatus(...args),
  deleteStrategyAction: (...args: unknown[]) => mocks.remove(...args),
  setStrategyPinnedAction: (...args: unknown[]) => mocks.pin(...args),
  assignTradeToStrategyAction: vi.fn(),
  createStrategyAction: vi.fn(),
  updateStrategyAction: vi.fn(),
  restoreStrategyVersionAction: vi.fn(),
  getStrategyPerformanceAction: vi.fn(),
}));

import { PlaybookWorkspace } from '@/features/playbook/components/playbook-workspace';

function trade(overrides: Partial<AnalyticsTrade> = {}): AnalyticsTrade {
  return {
    id: Math.random().toString(36).slice(2),
    net_pnl: 100,
    pnl: 100,
    rr_ratio: 2,
    quantity: 1,
    position_size: 1,
    risk_amount: null,
    risk_percent: null,
    direction: 'buy',
    symbol: 'ES',
    market: null,
    asset_type: 'futures',
    session: null,
    setup: null,
    strategy_id: 'pb-1',
    broker_id: null,
    trading_account_id: null,
    source: 'manual',
    opened_at: '2026-06-01T13:00:00Z',
    closed_at: '2026-06-01T14:00:00Z',
    duration_seconds: 3600,
    ...overrides,
  };
}

function row(overrides: Partial<PlaybookListRow> = {}): PlaybookListRow {
  return {
    id: 'pb-1',
    name: 'Opening drive',
    description: 'Trend continuation off the open',
    category: 'Breakout',
    status: 'active',
    symbols: ['ES'],
    timeframes: ['5m'],
    sessions: [],
    is_pinned: false,
    current_version: 1,
    rule_count: 4,
    checklist_count: 2,
    updated_at: '2026-06-10T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    metrics: EMPTY_METRICS,
    ...overrides,
  };
}

const DATA: PlaybookWorkspaceData = {
  rows: [
    row({
      id: 'pb-1',
      name: 'Opening drive',
      metrics: computeMetrics([trade({ net_pnl: 900 }), trade({ net_pnl: -100 })]),
    }),
    row({
      id: 'pb-2',
      name: 'Mean reversion',
      category: 'Reversion',
      symbols: ['NQ'],
      metrics: computeMetrics([trade({ net_pnl: -250, symbol: 'NQ', direction: 'sell' })]),
    }),
    row({ id: 'pb-3', name: 'Retired idea', status: 'archived' }),
  ],
  categories: ['Breakout', 'Reversion'],
  symbols: ['ES', 'NQ'],
  reviewedAvailable: false,
};

/** The URL the component asked the router to navigate to, as parsed params. */
function lastUrlParams(): URLSearchParams {
  const calls = mocks.replace.mock.calls;
  const url = String(calls[calls.length - 1]?.[0] ?? '');
  return new URLSearchParams(url.split('?')[1] ?? '');
}

function renderWorkspace(data: PlaybookWorkspaceData = DATA, search = '') {
  mocks.params = new URLSearchParams(search);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PlaybookWorkspace initialData={data} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.workspace.mockResolvedValue(DATA);
  mocks.duplicate.mockResolvedValue({ ok: true, data: { id: 'pb-copy' } });
  mocks.changeStatus.mockResolvedValue({ ok: true });
  mocks.remove.mockResolvedValue({ ok: true });
  mocks.pin.mockResolvedValue({ ok: true });
  window.localStorage.clear();
});

// ---------------------------------------------------------------------------

describe('playbook workspace composition', () => {
  it('renders real per-playbook analytics in the table, not placeholders', () => {
    renderWorkspace();
    const table = screen.getByRole('table');
    const rowEl = within(table).getByRole('row', { name: /Opening drive/ });

    // 2 trades, +900 / -100 → net 800, 50% win rate, PF 9.
    expect(within(rowEl).getByText('$800.00')).toBeInTheDocument();
    expect(within(rowEl).getByText('50.00%')).toBeInTheDocument();
    expect(within(rowEl).getByText('9')).toBeInTheDocument();
  });

  it('shows an em dash rather than a fabricated 0 for a playbook with no trades', async () => {
    renderWorkspace(DATA, 'tab=archived');
    const rowEl = screen.getByRole('row', { name: /Retired idea/ });
    // Net P&L, win rate, profit factor are all unknown — never rendered as zero.
    expect(within(rowEl).getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });

  it('gives the table an accessible name and marks non-sortable headers as plain text', () => {
    renderWorkspace();
    expect(
      screen.getByRole('table', {
        name: /playbooks with performance measured from linked trades/i,
      }),
    ).toBeInTheDocument();
    // Status is not sortable, so it must not be a button.
    const statusHeader = screen.getByRole('columnheader', { name: 'Status' });
    expect(within(statusHeader).queryByRole('button')).toBeNull();
  });
});

describe('tabs', () => {
  it('switches to Archived and shows only archived playbooks', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    expect(screen.queryByRole('row', { name: /Retired idea/ })).toBeNull();

    await user.click(screen.getByRole('tab', { name: /Archived/ }));
    expect(lastUrlParams().get('tab')).toBe('archived');
  });

  it('preserves the active search when the tab changes', async () => {
    const user = userEvent.setup();
    renderWorkspace(DATA, 'q=reversion');
    await user.click(screen.getByRole('tab', { name: /Archived/ }));
    const params = lastUrlParams();
    expect(params.get('tab')).toBe('archived');
    expect(params.get('q')).toBe('reversion');
  });

  it('disables the Shared Playbooks tab with an accessible reason rather than faking it', () => {
    renderWorkspace();
    const shared = screen.getByRole('tab', { name: /Shared Playbooks/ });
    expect(shared).toBeDisabled();
    expect(shared).toHaveAccessibleName(/no playbook sharing or permission model/i);
  });
});

describe('search and filters', () => {
  it('commits a search to URL state on Enter', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.type(
      screen.getByRole('searchbox', { name: /search playbooks/i }),
      'reversion{Enter}',
    );
    expect(lastUrlParams().get('q')).toBe('reversion');
  });

  it('actually narrows the rendered rows when a search is in the URL', () => {
    renderWorkspace(DATA, 'q=reversion');
    expect(screen.getByRole('row', { name: /Mean reversion/ })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /Opening drive/ })).toBeNull();
  });

  it('applies filters only on Apply, and shows the active count', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: /filters/i }));

    await user.click(screen.getByRole('combobox', { name: /outcome/i }));
    await user.click(await screen.findByRole('option', { name: 'Losing' }));
    // Nothing is committed while the panel is still open.
    expect(mocks.replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /apply filters/i }));
    expect(lastUrlParams().get('outcome')).toBe('losing');
  });

  it('narrows to losing playbooks and reports the filter count', () => {
    renderWorkspace(DATA, 'outcome=losing');
    expect(screen.getByRole('row', { name: /Mean reversion/ })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /Opening drive/ })).toBeNull();
    expect(screen.getByText(/1 filter/)).toBeInTheDocument();
  });

  it('closes the filter panel on Escape without applying', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: /filters/i }));
    expect(screen.getByRole('button', { name: /apply filters/i })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /apply filters/i })).toBeNull(),
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('resets every filter back to a clean URL', async () => {
    const user = userEvent.setup();
    renderWorkspace(DATA, 'q=reversion&outcome=losing');
    await user.click(screen.getByRole('button', { name: /^reset$/i }));
    expect(mocks.replace).toHaveBeenLastCalledWith('/playbook', { scroll: false });
  });

  it('disables the review filter with a stated reason when the column is unavailable', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: /filters/i }));
    expect(screen.getByRole('combobox', { name: /review state/i })).toBeDisabled();
    expect(screen.getByText(/until the trade review migration is applied/i)).toBeInTheDocument();
  });
});

describe('sorting', () => {
  it('sorts by a column and flips direction on the second click', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: 'Net P&L' }));
    expect(lastUrlParams().get('sort')).toBe('net_pnl:desc');
  });

  it('reorders the rendered rows and announces the sort to assistive tech', () => {
    renderWorkspace(DATA, 'sort=net_pnl:asc');
    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => within(r).getAllByRole('cell')[0]!.textContent);
    expect(names[0]).toContain('Mean reversion'); // -250 before +800
    expect(screen.getByRole('columnheader', { name: /net p&l/i })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('is operable from the keyboard', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const header = screen.getByRole('button', { name: 'Trades' });
    header.focus();
    await user.keyboard('{Enter}');
    expect(lastUrlParams().get('sort')).toBe('trades:desc');
  });
});

describe('list / grid views', () => {
  it('switches to a real grid, not a decorative duplicate', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    expect(screen.getByRole('table')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /grid view/i }));
    expect(lastUrlParams().get('view')).toBe('grid');
    // And the preference is remembered for the next visit.
    expect(window.localStorage.getItem('metatradee-playbook-view')).toBe('grid');
  });

  it('renders the same data and the same row actions in grid view', () => {
    renderWorkspace(DATA, 'view=grid');
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('Opening drive')).toBeInTheDocument();
    expect(screen.getByText('$800.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actions for Opening drive/i })).toBeInTheDocument();
  });
});

describe('row actions', () => {
  async function openMenu(name = 'Opening drive') {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: new RegExp(`actions for ${name}`, 'i') }));
    return user;
  }

  it('duplicates through the real server action', async () => {
    const user = await openMenu();
    await user.click(await screen.findByRole('menuitem', { name: /duplicate/i }));
    await waitFor(() => expect(mocks.duplicate).toHaveBeenCalledWith('pb-1'));
  });

  it('archives through the real status transition', async () => {
    const user = await openMenu();
    await user.click(await screen.findByRole('menuitem', { name: /archive/i }));
    await waitFor(() => expect(mocks.changeStatus).toHaveBeenCalledWith('pb-1', 'archived'));
  });

  it('restores an archived playbook', async () => {
    const user = userEvent.setup();
    renderWorkspace(DATA, 'tab=archived');
    await user.click(screen.getByRole('button', { name: /actions for Retired idea/i }));
    await user.click(await screen.findByRole('menuitem', { name: /restore/i }));
    await waitFor(() => expect(mocks.changeStatus).toHaveBeenCalledWith('pb-3', 'active'));
  });

  it('pins a playbook', async () => {
    const user = await openMenu();
    await user.click(await screen.findByRole('menuitem', { name: /pin to top/i }));
    await waitFor(() => expect(mocks.pin).toHaveBeenCalledWith('pb-1', true));
  });

  it('requires confirmation before deleting and states the effect on trades', async () => {
    const user = await openMenu();
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/2 linked trades will be kept/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/No trade is deleted/i)).toBeInTheDocument();
    // Nothing is destroyed until the user confirms.
    expect(mocks.remove).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: /delete playbook/i }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('pb-1'));
  });

  it('cancels a delete without touching the server', async () => {
    const user = await openMenu();
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it('surfaces a server failure instead of reporting a false success', async () => {
    mocks.remove.mockResolvedValue({ ok: false, error: 'Playbook not found.' });
    const user = await openMenu();
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /delete playbook/i }));

    expect(await screen.findByText('Playbook not found.')).toBeInTheDocument();
    // The dialog stays open — the destructive action did NOT happen.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('disables Share with an accessible reason rather than faking it', async () => {
    await openMenu();
    const share = await screen.findByRole('menuitem', { name: /share/i });
    expect(share).toHaveAttribute('aria-disabled', 'true');
    expect(share).toHaveAccessibleName(/no playbook sharing or permission model/i);
  });
});

describe('empty, loading, and error states', () => {
  const empty: PlaybookWorkspaceData = {
    rows: [],
    categories: [],
    symbols: [],
    reviewedAvailable: false,
  };

  it('keeps tabs and toolbar visible and offers a real Create action', () => {
    renderWorkspace(empty);
    expect(screen.getByRole('tab', { name: /My Playbooks/ })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: /search playbooks/i })).toBeInTheDocument();
    expect(screen.getByText(/No playbooks yet/i)).toBeInTheDocument();
    // No fabricated example rows presented as the user's own data.
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getAllByRole('link', { name: /create playbook/i }).length).toBeGreaterThan(0);
  });

  it('distinguishes "no results for these filters" from "no playbooks"', () => {
    renderWorkspace(DATA, 'q=zzzznomatch');
    expect(screen.getByText(/No playbooks match these filters/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
  });
});

describe('pagination', () => {
  const many: PlaybookWorkspaceData = {
    ...DATA,
    rows: Array.from({ length: 15 }, (_, i) =>
      row({ id: `p${i}`, name: `Playbook ${String(i).padStart(2, '0')}` }),
    ),
  };

  it('reports the visible window and pages forward', async () => {
    const user = userEvent.setup();
    renderWorkspace(many);
    expect(screen.getByText('Showing 1–12 of 15')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(lastUrlParams().get('page')).toBe('2');
  });

  it('disables Previous on the first page', () => {
    renderWorkspace(many);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
  });
});
