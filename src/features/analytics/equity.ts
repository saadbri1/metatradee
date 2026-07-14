/**
 * Equity + drawdown analytics. Equity basis = cumulative realized net P&L
 * (optionally offset by a starting balance). Drawdown is peak-to-trough on that
 * equity series; magnitude is reported as a positive number.
 */
import { mean, round } from './math';
import type { AnalyticsTrade, DrawdownStats, EquityPoint } from './types';

export function computeEquityCurve(trades: AnalyticsTrade[], startBalance = 0): EquityPoint[] {
  const decided = trades
    .filter((t) => t.net_pnl !== null)
    .sort((a, b) => (Date.parse(a.closed_at ?? '') || 0) - (Date.parse(b.closed_at ?? '') || 0));

  const points: EquityPoint[] = [];
  let equity = startBalance;
  let peak = startBalance;
  decided.forEach((t, i) => {
    equity += t.net_pnl as number;
    peak = Math.max(peak, equity);
    points.push({
      index: i,
      closed_at: t.closed_at,
      equity: round(equity, 2) ?? 0,
      drawdown: round(equity - peak, 2) ?? 0,
    });
  });
  return points;
}

export function computeDrawdownStats(points: EquityPoint[]): DrawdownStats {
  if (points.length === 0) {
    return {
      maxDrawdown: 0,
      maxDrawdownPct: null,
      avgDrawdown: 0,
      currentDrawdown: 0,
      maxDrawdownDurationTrades: 0,
    };
  }

  let peak = points[0]!.equity;
  let maxDd = 0;
  let maxDdPct: number | null = null;
  let curDuration = 0;
  let maxDuration = 0;
  const drawdownsDuringDD: number[] = [];

  for (const p of points) {
    if (p.equity >= peak) {
      peak = p.equity;
      curDuration = 0;
    } else {
      curDuration += 1;
      maxDuration = Math.max(maxDuration, curDuration);
      const dd = peak - p.equity;
      drawdownsDuringDD.push(dd);
      if (dd > maxDd) {
        maxDd = dd;
        maxDdPct = peak !== 0 ? (dd / Math.abs(peak)) * 100 : null;
      }
    }
  }

  const last = points[points.length - 1]!;
  const runningPeak = Math.max(...points.map((p) => p.equity));
  const currentDrawdown = Math.max(0, runningPeak - last.equity);

  return {
    maxDrawdown: round(maxDd, 2) ?? 0,
    maxDrawdownPct: round(maxDdPct, 2),
    avgDrawdown: round(mean(drawdownsDuringDD) ?? 0, 2) ?? 0,
    currentDrawdown: round(currentDrawdown, 2) ?? 0,
    maxDrawdownDurationTrades: maxDuration,
  };
}
