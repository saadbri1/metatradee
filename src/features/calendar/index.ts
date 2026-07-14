/**
 * Calendar/session engine entry point. A pure, deterministic time-dimensioned
 * view over the same trades analytics reads — every metric comes from the 9.8
 * KPI engine, so all views reconcile with analytics and the journal.
 */
import type { AnalyticsTrade } from '@/features/analytics/types';
import { computeKpis } from '@/features/analytics/kpis';
import { buildDailyCalendar } from './calendar';
import { bucketByTime, sessionStats, type TimeDimension } from './buckets';
import { computeStreaks } from './streaks';
import type { CalendarDay, SessionStat, StreakStats, TimeBucketRow } from './types';

export * from './types';
export { tzParts, DOW_LABELS, MONTH_LABELS, addDays, dayDiff } from './time';
export { buildDailyCalendar, classifyDay } from './calendar';
export { bucketByTime, sessionStats } from './buckets';
export { computeStreaks } from './streaks';
export { classifyTradeStyle, STYLE_THRESHOLDS } from './duration';
export { SESSIONS, primarySession, sessionMembership } from './sessions';

export interface CalendarSummary {
  days: CalendarDay[];
  streaks: StreakStats;
  sessions: SessionStat[];
  hourly: TimeBucketRow[];
  dayOfWeek: TimeBucketRow[];
  monthly: TimeBucketRow[];
  totalNetProfit: number;
  generatedAt: string;
}

export function buildCalendarSummary(trades: AnalyticsTrade[], tz: string): CalendarSummary {
  const days = buildDailyCalendar(trades, tz);
  return {
    days,
    streaks: computeStreaks(days),
    sessions: sessionStats(trades),
    hourly: bucketByTime(trades, 'hour', tz),
    dayOfWeek: bucketByTime(trades, 'dayOfWeek', tz),
    monthly: bucketByTime(trades, 'month', tz),
    totalNetProfit: computeKpis(trades).netProfit,
    generatedAt: new Date().toISOString(),
  };
}

export type { TimeDimension };
