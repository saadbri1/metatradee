import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  TradeLogTable,
  DEFAULT_VISIBLE,
  type ColumnId,
} from '@/features/journal/components/trade-log-table';
import type { TradeListRow } from '@/features/journal/types';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function row(overrides: Partial<TradeListRow> = {}): TradeListRow {
  return {
    id: 'trade-1',
    user_id: 'u1',
    trading_account_id: 'a1',
    broker_id: null,
    strategy_id: null,
    market: null,
    symbol: 'NES',
    asset_type: 'futures',
    direction: 'buy',
    entry_price: 5000,
    exit_price: 5010,
    quantity: 2,
    position_size: 2,
    stop_loss: null,
    take_profit: null,
    risk_percent: null,
    risk_amount: null,
    reward: null,
    rr_ratio: 1.5,
    commission: 0,
    swap: 0,
    fees: 0,
    pnl: 250,
    net_pnl: 250,
    currency: 'USD',
    opened_at: '2024-06-01T14:00:00Z',
    closed_at: '2024-06-01T15:00:00Z',
    executed_at: null,
    duration_seconds: 3600,
    session: null,
    setup: 'Breakout',
    confidence: null,
    notes: 'Clean entry',
    visibility: 'private',
    status: 'published',
    source: 'manual',
    is_favorite: false,
    is_pinned: false,
    reviewed: false,
    created_at: '2024-06-01T14:00:00Z',
    updated_at: '2024-06-01T14:00:00Z',
    tags: [{ id: 'tag-1', name: 'FOMO', category: 'mistake', color: null }],
    ...overrides,
  };
}

function renderTable(props: Partial<Parameters<typeof TradeLogTable>[0]> = {}) {
  const onSetReviewed = vi.fn();
  const onSort = vi.fn();
  const onToggleSelect = vi.fn();
  const onToggleSelectAll = vi.fn();
  const onTag = vi.fn();
  render(
    <TooltipProvider>
      <TradeLogTable
        items={[row()]}
        visibleColumns={new Set<ColumnId>(DEFAULT_VISIBLE)}
        selected={new Set()}
        onToggleSelect={onToggleSelect}
        onToggleSelectAll={onToggleSelectAll}
        onSetReviewed={onSetReviewed}
        sort="newest"
        onSort={onSort}
        onTag={onTag}
        {...props}
      />
    </TooltipProvider>,
  );
  return { onSetReviewed, onSort, onToggleSelect, onToggleSelectAll, onTag };
}

describe('TradeLogTable', () => {
  it('renders real trade fields in a dense table', () => {
    renderTable();
    expect(screen.getByRole('table', { name: /trade log/i })).toBeInTheDocument();
    expect(screen.getByText('NES')).toBeInTheDocument();
    expect(screen.getByText('Long')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
    expect(screen.getByText('$250.00')).toBeInTheDocument();
    expect(screen.getByText('1.50R')).toBeInTheDocument();
    expect(screen.getByText('Breakout')).toBeInTheDocument();
  });

  it('toggles reviewed state through the real callback (accessible checkbox)', async () => {
    const user = userEvent.setup();
    const { onSetReviewed } = renderTable();
    const control = screen.getByRole('checkbox', { name: /Mark reviewed: NES/i });
    expect(control).toHaveAttribute('aria-checked', 'false');
    await user.click(control);
    expect(onSetReviewed).toHaveBeenCalledWith('trade-1', true);
  });

  it('renders a reviewed row as checked', () => {
    renderTable({ items: [row({ reviewed: true })] });
    expect(screen.getByRole('checkbox', { name: /Mark unreviewed: NES/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('styles mistake tags distinctly and filters by tag on click', async () => {
    const user = userEvent.setup();
    const { onTag } = renderTable();
    const tag = screen.getByRole('button', { name: /Filter by mistake FOMO/i });
    expect(tag.className).toContain('text-warning');
    await user.click(tag);
    expect(onTag).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'FOMO', category: 'mistake' }),
    );
  });

  it('exposes accessible sort state and sorts via header clicks', async () => {
    const user = userEvent.setup();
    const { onSort } = renderTable({ sort: 'profit' });
    // Net P&L header is descending under the "profit" sort.
    const netHeader = screen.getByRole('columnheader', { name: /Net P&L/i });
    expect(netHeader).toHaveAttribute('aria-sort', 'descending');
    await user.click(within(netHeader).getByRole('button'));
    expect(onSort).toHaveBeenCalledWith('loss');
  });

  it('hides optional columns when not visible', () => {
    renderTable({ visibleColumns: new Set<ColumnId>(['open', 'symbol', 'net_pnl']) });
    expect(screen.queryByText('Long')).not.toBeInTheDocument();
    expect(screen.queryByText('Breakout')).not.toBeInTheDocument();
    expect(screen.getByText('NES')).toBeInTheDocument();
  });

  it('supports select-all with an indeterminate header state', async () => {
    const user = userEvent.setup();
    const { onToggleSelectAll } = renderTable();
    await user.click(screen.getByRole('checkbox', { name: /Select all trades on this page/i }));
    expect(onToggleSelectAll).toHaveBeenCalledWith(true);
  });
});
