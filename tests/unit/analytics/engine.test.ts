import { describe, it, expect } from 'vitest';
import { computeKpis } from '@/features/analytics/kpis';
import { computeEquityCurve, computeDrawdownStats } from '@/features/analytics/equity';
import { computeBreakdown } from '@/features/analytics/breakdowns';
import { computeAnalyticsSummary } from '@/features/analytics';
import type { AnalyticsTrade } from '@/features/analytics/types';

function mk(o: Partial<AnalyticsTrade>): AnalyticsTrade {
  return {
    id: o.id ?? Math.random().toString(36).slice(2),
    net_pnl: o.net_pnl ?? null,
    pnl: o.pnl ?? null,
    rr_ratio: o.rr_ratio ?? null,
    quantity: o.quantity ?? null,
    position_size: o.position_size ?? null,
    risk_amount: o.risk_amount ?? null,
    risk_percent: o.risk_percent ?? null,
    direction: o.direction ?? 'buy',
    symbol: o.symbol ?? 'EURUSD',
    market: o.market ?? null,
    asset_type: o.asset_type ?? null,
    session: o.session ?? null,
    strategy_id: o.strategy_id ?? null,
    broker_id: o.broker_id ?? null,
    trading_account_id: o.trading_account_id ?? null,
    source: o.source ?? 'manual',
    opened_at: o.opened_at ?? null,
    closed_at: o.closed_at ?? null,
    duration_seconds: o.duration_seconds ?? null,
  };
}

describe('computeKpis — known values', () => {
  const trades = [
    mk({ net_pnl: 100, closed_at: '2026-01-01T10:00:00Z' }),
    mk({ net_pnl: -50, closed_at: '2026-01-02T10:00:00Z' }),
    mk({ net_pnl: 0, closed_at: '2026-01-03T10:00:00Z' }),
    mk({ net_pnl: 200, closed_at: '2026-01-03T12:00:00Z' }),
  ];
  const k = computeKpis(trades);

  it('classifies wins/losses/break-even', () => {
    expect(k.wins).toBe(2);
    expect(k.losses).toBe(1);
    expect(k.breakEven).toBe(1);
  });
  it('computes gross/net and profit factor', () => {
    expect(k.grossProfit).toBe(300);
    expect(k.grossLoss).toBe(50);
    expect(k.netProfit).toBe(250);
    expect(k.profitFactor).toBe(6);
  });
  it('computes averages and extremes', () => {
    expect(k.avgWin).toBe(150);
    expect(k.avgLoss).toBe(50);
    expect(k.largestWin).toBe(200);
    expect(k.largestLoss).toBe(-50);
    expect(k.winRate).toBe(0.5);
  });
  it('counts trading days', () => {
    expect(k.tradingDays).toBe(3);
  });
});

describe('RECONCILIATION — analytics net profit equals Σ trade net_pnl', () => {
  const trades = [12.34, -5.6, 0, 100.01, -42.75, 8.9].map((v, i) =>
    mk({ net_pnl: v, closed_at: `2026-01-0${i + 1}T00:00:00Z` }),
  );
  it('nets exactly', () => {
    const expected = Math.round(trades.reduce((s, t) => s + (t.net_pnl ?? 0), 0) * 100) / 100;
    expect(computeKpis(trades).netProfit).toBe(expected);
  });
});

describe('edge cases (no NaN/Infinity leaks)', () => {
  it('handles zero trades', () => {
    const k = computeKpis([]);
    expect(k.totalTrades).toBe(0);
    expect(k.netProfit).toBe(0);
    expect(k.profitFactor).toBeNull();
    expect(k.winRate).toBeNull();
  });
  it('handles all wins (no gross loss → PF null, not Infinity)', () => {
    const k = computeKpis([mk({ net_pnl: 10 }), mk({ net_pnl: 20 })]);
    expect(k.grossLoss).toBe(0);
    expect(k.profitFactor).toBeNull();
    expect(k.winRate).toBe(1);
  });
  it('handles a single trade (streaks + advanced degrade gracefully)', () => {
    const s = computeAnalyticsSummary([mk({ net_pnl: 5, closed_at: '2026-01-01T00:00:00Z' })]);
    expect(s.kpis.maxConsecutiveWins).toBe(1);
    expect(s.advanced.sharpe).toBeNull(); // n < 2
    expect(Number.isFinite(s.kpis.netProfit)).toBe(true);
  });
  it('does not fabricate PnL for null net_pnl trades', () => {
    const k = computeKpis([mk({ net_pnl: null }), mk({ net_pnl: 50 })]);
    expect(k.totalTrades).toBe(2);
    expect(k.wins).toBe(1);
    expect(k.netProfit).toBe(50);
  });
});

describe('equity + drawdown', () => {
  it('builds a cumulative equity curve and max drawdown', () => {
    const trades = [100, -150, 50].map((v, i) =>
      mk({ net_pnl: v, closed_at: `2026-01-0${i + 1}T00:00:00Z` }),
    );
    const curve = computeEquityCurve(trades, 0);
    expect(curve.map((p) => p.equity)).toEqual([100, -50, 0]);
    const dd = computeDrawdownStats(curve);
    expect(dd.maxDrawdown).toBe(150); // peak 100 → trough -50
  });
  it('is empty-safe', () => {
    expect(computeDrawdownStats([]).maxDrawdown).toBe(0);
  });
});

describe('breakdowns reuse one engine', () => {
  it('partitions by direction and reconciles subtotals', () => {
    const trades = [
      mk({ net_pnl: 100, direction: 'buy', closed_at: '2026-01-01T00:00:00Z' }),
      mk({ net_pnl: -40, direction: 'sell', closed_at: '2026-01-02T00:00:00Z' }),
      mk({ net_pnl: 60, direction: 'buy', closed_at: '2026-01-03T00:00:00Z' }),
    ];
    const rows = computeBreakdown(trades, 'direction');
    const total = rows.reduce((s, r) => s + r.kpis.netProfit, 0);
    expect(total).toBe(computeKpis(trades).netProfit);
    expect(rows.find((r) => r.key === 'buy')?.kpis.netProfit).toBe(160);
  });
});
