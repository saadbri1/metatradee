/**
 * Analytics engine entry point. `computeAnalyticsSummary` runs the full pipeline
 * over a normalized trade set; it is pure and deterministic so it runs
 * server-side (aggregation plane) and is unit-tested against known fixtures.
 */
import { computeKpis } from './kpis';
import { computeAdvancedMetrics } from './advanced';
import { computeEquityCurve, computeDrawdownStats } from './equity';
import { computeRiskStats } from './risk';
import type { AnalyticsSummary, AnalyticsTrade } from './types';

export * from './types';
export { computeKpis } from './kpis';
export { computeAdvancedMetrics } from './advanced';
export { computeEquityCurve, computeDrawdownStats } from './equity';
export { computeRiskStats } from './risk';
export { computeBreakdown } from './breakdowns';

export function computeAnalyticsSummary(
  trades: AnalyticsTrade[],
  startBalance = 0,
): AnalyticsSummary {
  const kpis = computeKpis(trades);
  const equityCurve = computeEquityCurve(trades, startBalance);
  const drawdown = computeDrawdownStats(equityCurve);
  const advanced = computeAdvancedMetrics(trades, kpis, drawdown);
  const risk = computeRiskStats(trades);
  return {
    kpis,
    advanced,
    equityCurve,
    drawdown,
    risk,
    generatedAt: new Date().toISOString(),
  };
}
