import { describe, it, expect } from 'vitest';
import { computeRiskStats } from '@/features/analytics/risk';
import type { AnalyticsTrade } from '@/features/analytics/types';

function mk(risk: number | null): AnalyticsTrade {
  return {
    id: 'r',
    net_pnl: 0,
    pnl: 0,
    rr_ratio: null,
    quantity: null,
    position_size: null,
    risk_amount: risk,
    risk_percent: risk === null ? null : 1,
    direction: 'buy',
    symbol: 'X',
    market: null,
    asset_type: null,
    session: null,
    strategy_id: null,
    broker_id: null,
    trading_account_id: null,
    source: 'manual',
    opened_at: null,
    closed_at: null,
    duration_seconds: null,
  };
}

describe('computeRiskStats', () => {
  it('averages only trades that carry risk and flags the rest', () => {
    const stats = computeRiskStats([mk(100), mk(200), mk(null)]);
    expect(stats.avgRiskAmount).toBe(150);
    expect(stats.maxRiskAmount).toBe(200);
    expect(stats.tradesWithRisk).toBe(2);
    expect(stats.tradesMissingRisk).toBe(1);
  });
  it('is empty-safe', () => {
    const stats = computeRiskStats([]);
    expect(stats.avgRiskAmount).toBeNull();
    expect(stats.tradesWithRisk).toBe(0);
  });
});
