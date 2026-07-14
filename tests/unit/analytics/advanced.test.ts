import { describe, it, expect } from 'vitest';
import { computeKpis } from '@/features/analytics/kpis';
import { computeEquityCurve, computeDrawdownStats } from '@/features/analytics/equity';
import { computeAdvancedMetrics } from '@/features/analytics/advanced';
import type { AnalyticsTrade } from '@/features/analytics/types';

function trade(net: number, i: number): AnalyticsTrade {
  return {
    id: `t${i}`,
    net_pnl: net,
    pnl: net,
    rr_ratio: null,
    quantity: 1,
    position_size: 1,
    risk_amount: null,
    risk_percent: null,
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
    closed_at: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    duration_seconds: null,
  };
}

function advanced(nets: number[]) {
  const trades = nets.map((n, i) => trade(n, i));
  const kpis = computeKpis(trades);
  const dd = computeDrawdownStats(computeEquityCurve(trades, 0));
  return computeAdvancedMetrics(trades, kpis, dd);
}

describe('Sharpe / Sortino', () => {
  it('computes a per-trade Sharpe on a known series', () => {
    // returns [10,20,30] → mean 20, sample sd 10 → Sharpe 2
    expect(advanced([10, 20, 30]).sharpe).toBe(2);
  });
  it('returns null when n < 2 or variance is zero', () => {
    expect(advanced([10]).sharpe).toBeNull();
    expect(advanced([10, 10, 10]).sharpe).toBeNull();
  });
});

describe('Kelly / risk of ruin', () => {
  it('computes Kelly from win rate and payoff', () => {
    // 3 wins @100, 2 losses @50 → W=0.6, payoff=2 → Kelly = 0.6 - 0.4/2 = 0.4
    const a = advanced([100, 100, 100, -50, -50]);
    expect(a.kelly).toBe(0.4);
    expect(a.riskOfRuin).not.toBeNull();
    expect(a.riskOfRuin! >= 0 && a.riskOfRuin! <= 1).toBe(true);
  });
  it('reports certain ruin when there is no edge', () => {
    const a = advanced([-10, -20, -30]); // all losses
    expect(a.riskOfRuin).toBe(1);
    expect(a.kelly).toBeNull(); // no wins → no payoff
  });
});

describe('excursion metrics are null (not fabricated)', () => {
  it('flags MFE/MAE/edge as unavailable with a note', () => {
    const a = advanced([10, -5, 20]);
    expect(a.avgMfe).toBeNull();
    expect(a.avgMae).toBeNull();
    expect(a.edgeRatio).toBeNull();
    expect(a.notes.some((n) => n.includes('excursion'))).toBe(true);
  });
});
