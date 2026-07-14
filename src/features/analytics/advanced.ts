/**
 * Advanced metrics. Formulas are STANDARD textbook definitions with explicit
 * assumptions (documented per metric); align to the FRS when it exists. Every
 * metric guards n<2 / zero-variance / all-wins / all-losses / div-by-zero and
 * returns null (never NaN/Infinity) so nothing bad reaches the UI.
 *
 *   sharpe   = mean(r) / stdev(r)                      r = per-trade net P&L,
 *                                                      rf = 0, NON-annualized
 *   sortino  = mean(r) / downsideDeviation(r, 0)
 *   calmar   = netProfit / maxDrawdown                 (simplified; no annualization)
 *   recovery = netProfit / maxDrawdown
 *   kelly    = W - (1 - W) / R    where R = avgWin/avgLoss (payoff)
 *   riskOfRuin ≈ ((1 - a)/(1 + a))^U  with advantage a = (W·R - (1-W))/R,
 *                U = capital units (default 10); 1 when edge ≤ 0
 */
import { downsideDeviation, mean, round, stdev } from './math';
import type { AdvancedMetrics, AnalyticsTrade, DrawdownStats, Kpis } from './types';

const CAPITAL_UNITS = 10; // risk-of-ruin capital units (configurable assumption)

export function computeAdvancedMetrics(
  trades: AnalyticsTrade[],
  kpis: Kpis,
  drawdown: DrawdownStats,
): AdvancedMetrics {
  const notes: string[] = [];
  const returns = trades.filter((t) => t.net_pnl !== null).map((t) => t.net_pnl as number);

  const sd = stdev(returns);
  const m = mean(returns);
  const sharpe = m !== null && sd !== null && sd > 0 ? round(m / sd, 3) : null;

  const dsd = downsideDeviation(returns, 0);
  const sortino = m !== null && dsd !== null && dsd > 0 ? round(m / dsd, 3) : null;

  const calmar = drawdown.maxDrawdown > 0 ? round(kpis.netProfit / drawdown.maxDrawdown, 3) : null;
  const recoveryFactor =
    drawdown.maxDrawdown > 0 ? round(kpis.netProfit / drawdown.maxDrawdown, 3) : null;

  const payoff =
    kpis.avgWin !== null && kpis.avgLoss !== null && kpis.avgLoss > 0
      ? kpis.avgWin / kpis.avgLoss
      : null;
  const W = kpis.winRate;

  let kelly: number | null = null;
  if (W !== null && payoff !== null && payoff > 0) {
    kelly = round(W - (1 - W) / payoff, 4);
  }

  let riskOfRuin: number | null = null;
  if (W !== null) {
    if (W <= 0) {
      riskOfRuin = 1; // no wins → certain ruin
    } else if (payoff !== null && payoff > 0) {
      const a = (W * payoff - (1 - W)) / payoff; // per-trade advantage
      if (a <= 0) riskOfRuin = 1;
      else if (a >= 1) riskOfRuin = 0;
      else riskOfRuin = round(((1 - a) / (1 + a)) ** CAPITAL_UNITS, 4);
    }
  }

  const expectancyScore =
    kpis.expectancy !== null && kpis.avgLoss !== null && kpis.avgLoss > 0
      ? round(kpis.expectancy / kpis.avgLoss, 3)
      : null;

  // Profit consistency: share of profitable trading days.
  const byDay = new Map<string, number>();
  for (const t of trades) {
    if (t.net_pnl === null || !t.closed_at) continue;
    const d = new Date(t.closed_at);
    if (Number.isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + t.net_pnl);
  }
  const days = [...byDay.values()];
  const profitConsistency =
    days.length > 0 ? round((days.filter((v) => v > 0).length / days.length) * 100, 1) : null;

  // Excursion-based metrics require MAE/MFE, which the trade schema does not
  // capture yet — reported as null with a note (never fabricated).
  notes.push(
    'MFE/MAE, trade efficiency, and edge ratio require excursion capture (not in schema).',
  );
  if (sharpe !== null) notes.push('Sharpe/Sortino are per-trade and non-annualized.');

  return {
    sharpe,
    sortino,
    calmar,
    expectancyScore,
    profitConsistency,
    tradeEfficiency: null,
    avgMfe: null,
    avgMae: null,
    edgeRatio: null,
    recoveryFactor,
    riskOfRuin,
    kelly,
    notes,
  };
}
