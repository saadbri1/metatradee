/**
 * Daily calendar builder. Groups trades into tz-correct days and scores each day
 * with the 9.8 KPI engine. Σ(day.netProfit) == analytics net (reconciliation),
 * because grouping only re-partitions the same net_pnl.
 */
import { computeKpis } from '@/features/analytics/kpis';
import type { AnalyticsTrade } from '@/features/analytics/types';
import { tzParts } from './time';
import type { CalendarDay, DayClassification } from './types';

export function classifyDay(net: number): DayClassification {
  if (net > 0) return 'win';
  if (net < 0) return 'loss';
  return 'break_even';
}

export function buildDailyCalendar(trades: AnalyticsTrade[], tz: string): CalendarDay[] {
  const groups = new Map<string, AnalyticsTrade[]>();
  for (const t of trades) {
    if (!t.closed_at) continue;
    const parts = tzParts(t.closed_at, tz);
    if (!parts) continue;
    const arr = groups.get(parts.dateKey);
    if (arr) arr.push(t);
    else groups.set(parts.dateKey, [t]);
  }

  return [...groups.entries()]
    .map(([dateKey, group]) => {
      const kpis = computeKpis(group);
      return { dateKey, kpis, classification: classifyDay(kpis.netProfit) };
    })
    .sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1));
}
