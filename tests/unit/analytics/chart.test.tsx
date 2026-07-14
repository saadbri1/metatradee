import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EquityChart } from '@/features/analytics/components/equity-chart';
import type { EquityPoint } from '@/features/analytics/types';

const points: EquityPoint[] = [
  { index: 0, closed_at: '2026-01-01T00:00:00Z', equity: 100, drawdown: 0 },
  { index: 1, closed_at: '2026-01-02T00:00:00Z', equity: 50, drawdown: -50 },
  { index: 2, closed_at: '2026-01-03T00:00:00Z', equity: 175, drawdown: 0 },
];

describe('EquityChart accessibility', () => {
  it('exposes an aria-labelled image AND a data-table alternative', () => {
    render(<EquityChart points={points} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toContain('Equity curve');
    // Keyboard-reachable data-table alternative (per a11y spec).
    expect(screen.getByText('Show data table')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('renders an empty state without crashing', () => {
    render(<EquityChart points={[]} />);
    expect(screen.getByText(/No closed trades/i)).toBeInTheDocument();
  });
});
