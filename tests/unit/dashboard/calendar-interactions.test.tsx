import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TradingCalendarCard } from '@/features/dashboard/components/trading-calendar-card';
import type { DailyPnlPoint } from '@/features/dashboard/types';

const points: DailyPnlPoint[] = [
  {
    dateKey: '2026-07-03',
    netPnl: 125,
    tradeCount: 2,
    hasNotes: true,
    cumulative: 125,
  },
  {
    dateKey: '2026-07-06',
    netPnl: -40,
    tradeCount: 1,
    hasNotes: false,
    cumulative: 85,
  },
  {
    dateKey: '2026-07-10',
    netPnl: 0,
    tradeCount: 1,
    hasNotes: false,
    cumulative: 85,
  },
];

describe('trading calendar interactions', () => {
  it('moves across month boundaries and activates only populated days', async () => {
    const user = userEvent.setup();
    const onSelectDay = vi.fn();
    render(<TradingCalendarCard points={points} onSelectDay={onSelectDay} />);

    expect(screen.getByRole('heading', { name: 'July 2026' })).toBeInTheDocument();

    const profitableDay = screen.getByRole('button', {
      name: '2026-07-03, $125, 2 trades',
    });
    expect(profitableDay).toHaveTextContent('Has journal note');
    profitableDay.focus();
    await user.keyboard('{Enter}');
    expect(onSelectDay).toHaveBeenCalledWith('2026-07-03');

    expect(screen.getByRole('button', { name: '2026-07-06, -$40, 1 trades' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '2026-07-10, $0, 1 trades' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '2026-07-04, no trades' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('heading', { name: 'June 2026' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { name: 'July 2026' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeInTheDocument();
  });
});
