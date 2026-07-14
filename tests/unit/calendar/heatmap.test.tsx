import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarHeatmap } from '@/features/calendar/components/calendar-heatmap';
import type { CalendarDay } from '@/features/calendar/types';

function day(dateKey: string, net: number, trades: number): CalendarDay {
  return {
    dateKey,
    classification: net > 0 ? 'win' : net < 0 ? 'loss' : 'break_even',
    kpis: { netProfit: net, totalTrades: trades, winRate: 0.5 } as CalendarDay['kpis'],
  };
}

describe('CalendarHeatmap accessibility', () => {
  it('provides an aria-labelled image and a data-table alternative', () => {
    render(
      <CalendarHeatmap
        days={[day('2026-01-01', 100, 3), day('2026-01-03', -40, 2)]}
        metric="net"
        onMetricChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('heatmap');
    expect(screen.getByText('Show data table')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('renders an empty state safely', () => {
    render(<CalendarHeatmap days={[]} metric="net" onMetricChange={vi.fn()} />);
    expect(screen.getByText(/No trades in this range/i)).toBeInTheDocument();
  });
});
