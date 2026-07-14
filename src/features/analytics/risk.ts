/**
 * Risk analytics. Trades missing risk inputs are counted and flagged, never
 * fabricated — averages are computed only over trades that actually carry risk.
 */
import { mean, round } from './math';
import type { AnalyticsTrade, RiskStats } from './types';

export function computeRiskStats(trades: AnalyticsTrade[]): RiskStats {
  const amounts = trades
    .map((t) => t.risk_amount)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const percents = trades
    .map((t) => t.risk_percent)
    .filter((v): v is number => v !== null && Number.isFinite(v));

  return {
    avgRiskAmount: round(mean(amounts), 2),
    avgRiskPercent: round(mean(percents), 2),
    tradesWithRisk: amounts.length,
    tradesMissingRisk: trades.length - amounts.length,
    maxRiskAmount: amounts.length ? round(Math.max(...amounts), 2) : null,
  };
}
