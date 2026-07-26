/**
 * Per-playbook performance — pure, deterministic, and derived ONLY from real
 * linked closed trades.
 *
 * Every metric here is produced by the existing, unit-tested 9.8 KPI engine
 * (`computeKpis`); this module adds no new financial formula. Its whole job is
 * to GROUP a trade set by `strategy_id` once, so the workspace renders N rows
 * from a single read instead of N per-row queries.
 *
 * Reviewed % is the only metric computed here, and it is a plain count, not a
 * financial figure. It returns null (rendered as an em dash) when the
 * `trades.reviewed` column is not present, rather than implying 0%.
 */
import { computeKpis } from '@/features/analytics/kpis';
import type { AnalyticsTrade, Kpis } from '@/features/analytics/types';

export interface PlaybookMetrics {
  kpis: Kpis;
  /** Share of linked trades marked reviewed, 0–1. Null when unknown. */
  reviewedRate: number | null;
  /** Net P&L of long trades only; null when the playbook has no longs. */
  longNetPnl: number | null;
  /** Net P&L of short trades only; null when the playbook has no shorts. */
  shortNetPnl: number | null;
  /** Distinct symbols actually traded under this playbook, most-traded first. */
  symbols: string[];
  /** Most recent close among linked trades, ISO. Null when none are closed. */
  lastTradedAt: string | null;
}

export const EMPTY_METRICS: PlaybookMetrics = Object.freeze({
  kpis: computeKpis([]),
  reviewedRate: null,
  longNetPnl: null,
  shortNetPnl: null,
  symbols: [],
  lastTradedAt: null,
});

function directionNetPnl(trades: AnalyticsTrade[], direction: 'buy' | 'sell'): number | null {
  const subset = trades.filter((trade) => trade.direction === direction);
  if (subset.length === 0) return null;
  return computeKpis(subset).netProfit;
}

function rankedSymbols(trades: AnalyticsTrade[]): string[] {
  const counts = new Map<string, number>();
  for (const trade of trades) {
    if (!trade.symbol) continue;
    counts.set(trade.symbol, (counts.get(trade.symbol) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([s]) => s);
}

/**
 * Reviewed share over trades that actually carry the flag. Returns null when no
 * trade reports it — the column may not be migrated yet, and "unknown" must not
 * render as "0% reviewed".
 */
export function computeReviewedRate(trades: AnalyticsTrade[]): number | null {
  const known = trades.filter((trade) => typeof trade.reviewed === 'boolean');
  if (known.length === 0) return null;
  return known.filter((trade) => trade.reviewed).length / known.length;
}

export function computeMetrics(trades: AnalyticsTrade[]): PlaybookMetrics {
  if (trades.length === 0) return EMPTY_METRICS;
  const closes = trades
    .map((trade) => trade.closed_at)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort();
  return {
    kpis: computeKpis(trades),
    reviewedRate: computeReviewedRate(trades),
    longNetPnl: directionNetPnl(trades, 'buy'),
    shortNetPnl: directionNetPnl(trades, 'sell'),
    symbols: rankedSymbols(trades),
    lastTradedAt: closes.length > 0 ? closes[closes.length - 1]! : null,
  };
}

/**
 * Group a trade set by `strategy_id` and compute each group's metrics in one
 * pass. Trades with no playbook are ignored — they belong to no row.
 */
export function computeMetricsByPlaybook(
  trades: readonly AnalyticsTrade[],
): Map<string, PlaybookMetrics> {
  const grouped = new Map<string, AnalyticsTrade[]>();
  for (const trade of trades) {
    const id = trade.strategy_id;
    if (!id) continue;
    const bucket = grouped.get(id);
    if (bucket) bucket.push(trade);
    else grouped.set(id, [trade]);
  }
  const metrics = new Map<string, PlaybookMetrics>();
  for (const [id, group] of grouped) metrics.set(id, computeMetrics(group));
  return metrics;
}

/** Average win ÷ average loss magnitude. Null unless both sides exist. */
export function winLossRatio(kpis: Kpis): number | null {
  if (kpis.avgWin === null || kpis.avgLoss === null) return null;
  const loss = Math.abs(kpis.avgLoss);
  return loss === 0 ? null : kpis.avgWin / loss;
}
