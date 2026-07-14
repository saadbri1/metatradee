/**
 * Composite strategy scores — the SINGLE place these formulas live (FRS-default,
 * documented, adjustable). They are computed FROM the 9.8 KPI engine + adherence
 * data; no metric is recomputed here.
 *
 *   healthScore   = 0.4·winRateScore + 0.4·profitFactorScore + 0.2·adherenceScore
 *                   winRateScore     = winRate · 100
 *                   profitFactorScore= min(100, (PF/3)·100)  (PF 3 ⇒ 100; null ⇒
 *                                      100 if profitable else 0)
 *                   adherenceScore   = % of trades that followed the strategy
 *                                      (defaults to 50 when unknown)
 *   executionScore= mean(execution_quality) over adherence records
 * All clamped to 0–100; return null when there are no trades.
 */
import { mean, round } from '@/features/analytics/math';
import type { Kpis } from '@/features/analytics/types';
import type { AdherenceRecord } from './types';

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function computeAdherenceRate(records: AdherenceRecord[]): number | null {
  const decided = records.filter((r) => r.followed_strategy !== null);
  if (decided.length === 0) return null;
  return round((decided.filter((r) => r.followed_strategy).length / decided.length) * 100, 0);
}

export function computeExecutionScore(records: AdherenceRecord[]): number | null {
  const q = records
    .map((r) => r.execution_quality)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  return q.length ? round(mean(q), 0) : null;
}

export function computeStrategyHealth(
  kpis: Kpis,
  opts: { adherencePct?: number | null } = {},
): number | null {
  if (kpis.totalTrades === 0) return null;
  const winRateScore = (kpis.winRate ?? 0) * 100;
  const pfScore =
    kpis.profitFactor === null
      ? kpis.grossProfit > 0
        ? 100
        : 0
      : Math.min(100, (kpis.profitFactor / 3) * 100);
  const adherenceScore = opts.adherencePct ?? 50;
  return round(clamp(0.4 * winRateScore + 0.4 * pfScore + 0.2 * adherenceScore), 0);
}
