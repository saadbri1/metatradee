/** Calendar/session domain types. Metrics are 9.8 `Kpis` (no new metric type). */
import type { Kpis } from '@/features/analytics/types';
import type { SessionId } from './sessions';

export type CalendarView = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type HeatmapMetric = 'net' | 'trades' | 'winRate';
export type DayClassification = 'win' | 'loss' | 'break_even' | 'none';

export interface CalendarDay {
  dateKey: string; // YYYY-MM-DD in user tz
  kpis: Kpis;
  classification: DayClassification;
}

export interface TimeBucketRow {
  key: string;
  label: string;
  kpis: Kpis;
}

export interface SessionStat {
  id: SessionId;
  label: string;
  kpis: Kpis;
}

export interface StreakStats {
  winningDays: number;
  losingDays: number;
  breakEvenDays: number;
  tradingDays: number;
  inactiveDays: number;
  longestWinStreak: number;
  longestLossStreak: number;
  currentStreak: number;
  currentStreakType: 'win' | 'loss' | 'none';
  longestConsecutiveTradingDays: number;
  longestConsistency: number; // longest run of adjacent winning days
}
