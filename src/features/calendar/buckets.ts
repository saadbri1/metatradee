/**
 * Time-dimension buckets (hour/day-of-week/month/quarter/year) and session
 * buckets. Each bucket is scored with the 9.8 KPI engine — ONE engine, many
 * time groupings. Mutually-exclusive time buckets reconcile to the total;
 * session buckets are intentionally non-exclusive (overlap), documented.
 */
import { computeKpis } from '@/features/analytics/kpis';
import type { AnalyticsTrade } from '@/features/analytics/types';
import { DOW_LABELS, MONTH_LABELS, tzParts } from './time';
import { SESSIONS, sessionMembership } from './sessions';
import type { SessionStat, TimeBucketRow } from './types';

export type TimeDimension = 'hour' | 'dayOfWeek' | 'month' | 'quarter' | 'year';

function keyLabel(
  t: AnalyticsTrade,
  dim: TimeDimension,
  tz: string,
): { key: string; label: string; sort: number | string } | null {
  if (!t.closed_at) return null;
  const p = tzParts(t.closed_at, tz);
  if (!p) return null;
  switch (dim) {
    case 'hour':
      return { key: String(p.hour), label: `${String(p.hour).padStart(2, '0')}:00`, sort: p.hour };
    case 'dayOfWeek':
      return { key: String(p.weekday), label: DOW_LABELS[p.weekday]!, sort: p.weekday };
    case 'month':
      return {
        key: `${p.year}-${String(p.month).padStart(2, '0')}`,
        label: `${MONTH_LABELS[p.month - 1]} ${p.year}`,
        sort: `${p.year}-${String(p.month).padStart(2, '0')}`,
      };
    case 'quarter': {
      const q = Math.floor((p.month - 1) / 3) + 1;
      return { key: `${p.year}-Q${q}`, label: `${p.year} Q${q}`, sort: `${p.year}-${q}` };
    }
    case 'year':
      return { key: String(p.year), label: String(p.year), sort: p.year };
    default:
      return null;
  }
}

export function bucketByTime(
  trades: AnalyticsTrade[],
  dim: TimeDimension,
  tz: string,
): TimeBucketRow[] {
  const groups = new Map<
    string,
    { label: string; sort: number | string; trades: AnalyticsTrade[] }
  >();
  for (const t of trades) {
    const kl = keyLabel(t, dim, tz);
    if (!kl) continue;
    const g = groups.get(kl.key);
    if (g) g.trades.push(t);
    else groups.set(kl.key, { label: kl.label, sort: kl.sort, trades: [t] });
  }
  return [...groups.entries()]
    .map(([key, g]) => ({ key, label: g.label, kpis: computeKpis(g.trades), sort: g.sort }))
    .sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0))
    .map(({ key, label, kpis }) => ({ key, label, kpis }));
}

/** Per-session KPIs. Non-exclusive (a trade may count in London, NY, and overlap). */
export function sessionStats(trades: AnalyticsTrade[]): SessionStat[] {
  return SESSIONS.map((def) => {
    const members = trades.filter((t) => sessionMembership(t.closed_at).includes(def.id));
    return { id: def.id, label: def.label, kpis: computeKpis(members) };
  });
}
