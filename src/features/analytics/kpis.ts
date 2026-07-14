/**
 * Core KPI computation. Reconciles with the journal by construction:
 * netProfit === Σ trade.net_pnl (no separate PnL math). Only trades with a
 * computable net_pnl participate in win/loss stats; a null net_pnl trade is
 * counted in totalTrades but not classified (never fabricated as 0).
 *
 * Formulas
 *   winRate       = wins / decided            (decided = wins + losses + breakEven)
 *   grossProfit   = Σ net_pnl where > 0
 *   grossLoss     = Σ |net_pnl| where < 0
 *   netProfit     = grossProfit - grossLoss   (= Σ net_pnl)
 *   profitFactor  = grossProfit / grossLoss   (null if grossLoss = 0)
 *   expectancy    = netProfit / decided       (avg net P&L per decided trade)
 *   avgWin        = grossProfit / wins ; avgLoss = grossLoss / losses
 */
import { mean, round, safeDiv, sum } from './math';
import type { AnalyticsTrade, Kpis } from './types';

function dateKey(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function computeKpis(trades: AnalyticsTrade[]): Kpis {
  const decided = trades.filter((t) => t.net_pnl !== null);
  const netPnls = decided.map((t) => t.net_pnl as number);

  const wins = netPnls.filter((v) => v > 0);
  const losses = netPnls.filter((v) => v < 0);
  const breakEven = netPnls.filter((v) => v === 0);

  const grossProfit = round(sum(wins), 2) ?? 0;
  const grossLoss = round(sum(losses.map((v) => -v)), 2) ?? 0;
  const netProfit = round(grossProfit - grossLoss, 2) ?? 0;
  const decidedCount = decided.length;

  // Chronological streaks.
  const ordered = [...decided].sort(
    (a, b) => (Date.parse(a.closed_at ?? '') || 0) - (Date.parse(b.closed_at ?? '') || 0),
  );
  let maxW = 0;
  let maxL = 0;
  let curW = 0;
  let curL = 0;
  for (const t of ordered) {
    const v = t.net_pnl as number;
    if (v > 0) {
      curW += 1;
      curL = 0;
      maxW = Math.max(maxW, curW);
    } else if (v < 0) {
      curL += 1;
      curW = 0;
      maxL = Math.max(maxL, curL);
    } else {
      curW = 0;
      curL = 0;
    }
  }

  const tradingDays = new Set(
    decided.map((t) => dateKey(t.closed_at)).filter((d): d is string => d !== null),
  ).size;

  const rrs = trades.map((t) => t.rr_ratio).filter((v): v is number => v !== null);
  const holds = trades.map((t) => t.duration_seconds).filter((v): v is number => v !== null);
  const sizes = trades
    .map((t) => t.position_size ?? t.quantity)
    .filter((v): v is number => v !== null && v !== undefined);
  const volume = trades
    .map((t) => t.quantity)
    .filter((v): v is number => v !== null)
    .reduce((a, b) => a + b, 0);

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakEven: breakEven.length,
    winRate: round(safeDiv(wins.length, decidedCount), 4),
    lossRate: round(safeDiv(losses.length, decidedCount), 4),
    breakEvenRate: round(safeDiv(breakEven.length, decidedCount), 4),
    grossProfit,
    grossLoss,
    netProfit,
    profitFactor: round(safeDiv(grossProfit, grossLoss), 2),
    expectancy: round(safeDiv(netProfit, decidedCount), 2),
    avgWin: round(safeDiv(grossProfit, wins.length), 2),
    avgLoss: round(safeDiv(grossLoss, losses.length), 2),
    largestWin: wins.length ? round(Math.max(...wins), 2) : null,
    largestLoss: losses.length ? round(Math.min(...losses), 2) : null,
    avgRr: round(mean(rrs), 2),
    avgHoldingSeconds: round(mean(holds), 0),
    totalVolume: round(volume, 4) ?? 0,
    avgPositionSize: round(mean(sizes), 4),
    maxConsecutiveWins: maxW,
    maxConsecutiveLosses: maxL,
    tradingDays,
    avgTradesPerDay: round(safeDiv(decidedCount, tradingDays), 2),
  };
}
