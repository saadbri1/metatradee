import { describe, it, expect } from 'vitest';
import { computeStreaks } from '@/features/calendar/streaks';
import type { CalendarDay } from '@/features/calendar/types';

function day(dateKey: string, cls: CalendarDay['classification']): CalendarDay {
  return {
    dateKey,
    classification: cls,
    // kpis unused by streak logic; minimal shape.
    kpis: { netProfit: cls === 'win' ? 1 : cls === 'loss' ? -1 : 0 } as CalendarDay['kpis'],
  };
}

describe('computeStreaks', () => {
  it('is empty-safe', () => {
    const s = computeStreaks([]);
    expect(s.tradingDays).toBe(0);
    expect(s.longestWinStreak).toBe(0);
    expect(s.currentStreakType).toBe('none');
  });

  it('handles a single winning day', () => {
    const s = computeStreaks([day('2026-01-01', 'win')]);
    expect(s.winningDays).toBe(1);
    expect(s.longestWinStreak).toBe(1);
    expect(s.currentStreak).toBe(1);
    expect(s.currentStreakType).toBe('win');
    expect(s.inactiveDays).toBe(0);
  });

  it('computes win/loss streaks ignoring gaps', () => {
    const s = computeStreaks([
      day('2026-01-01', 'win'),
      day('2026-01-02', 'win'),
      day('2026-01-05', 'loss'),
      day('2026-01-06', 'loss'),
      day('2026-01-07', 'loss'),
      day('2026-01-08', 'win'),
    ]);
    expect(s.longestWinStreak).toBe(2);
    expect(s.longestLossStreak).toBe(3);
    expect(s.currentStreakType).toBe('win');
    expect(s.currentStreak).toBe(1);
  });

  it('counts inactive (no-trade) days across gaps', () => {
    // trading days Jan 1 and Jan 5 → span 5 days, 2 traded → 3 inactive.
    const s = computeStreaks([day('2026-01-01', 'win'), day('2026-01-05', 'loss')]);
    expect(s.inactiveDays).toBe(3);
    expect(s.longestConsecutiveTradingDays).toBe(1);
  });

  it('tracks adjacency streaks and consistency', () => {
    const s = computeStreaks([
      day('2026-01-01', 'win'),
      day('2026-01-02', 'win'),
      day('2026-01-03', 'win'),
      day('2026-01-05', 'win'),
    ]);
    expect(s.longestConsecutiveTradingDays).toBe(3);
    expect(s.longestConsistency).toBe(3); // adjacent winning run
    expect(s.longestWinStreak).toBe(4); // gaps ignored
  });

  it('handles all losses', () => {
    const s = computeStreaks([day('2026-01-01', 'loss'), day('2026-01-02', 'loss')]);
    expect(s.losingDays).toBe(2);
    expect(s.longestLossStreak).toBe(2);
    expect(s.longestWinStreak).toBe(0);
  });
});
