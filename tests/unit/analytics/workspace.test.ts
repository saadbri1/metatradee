import { describe, it, expect } from 'vitest';
import { computeBreakdown } from '@/features/analytics/breakdowns';
import { presetRange, inferPreset } from '@/features/analytics/date-presets';
import { buildInsights } from '@/features/analytics/insights';
import type { AnalyticsTrade, AnalyticsWorkspaceData } from '@/features/analytics/types';

function t(overrides: Partial<AnalyticsTrade> = {}): AnalyticsTrade {
  return {
    id: Math.random().toString(36).slice(2),
    net_pnl: 100,
    pnl: 100,
    rr_ratio: null,
    quantity: 1,
    position_size: 1,
    risk_amount: null,
    risk_percent: null,
    direction: 'buy',
    symbol: 'MES',
    market: null,
    asset_type: null,
    session: null,
    setup: null,
    strategy_id: null,
    broker_id: null,
    trading_account_id: null,
    source: 'manual',
    opened_at: '2024-06-03T14:00:00Z',
    closed_at: '2024-06-03T15:00:00Z',
    duration_seconds: 3600,
    ...overrides,
  };
}

describe('setup breakdown', () => {
  it('groups by setup and classifies missing setups as Unassigned', () => {
    const rows = computeBreakdown(
      [
        t({ setup: 'Breakout', net_pnl: 200 }),
        t({ setup: 'Breakout', net_pnl: -50 }),
        t({ setup: null, net_pnl: 30 }),
        t({ setup: '   ', net_pnl: 10 }),
      ],
      'setup',
    );
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.kpis]));
    expect(byKey.Breakout!.netProfit).toBe(150);
    expect(byKey.Unassigned!.totalTrades).toBe(2); // null + whitespace
  });
});

describe('date presets', () => {
  const now = new Date('2024-06-15T12:00:00Z');

  it('resolves fixed ranges deterministically at UTC boundaries', () => {
    expect(presetRange('all', now)).toEqual({});
    expect(presetRange('this_month', now).from).toBe('2024-06-01T00:00:00.000Z');
    expect(presetRange('previous_month', now)).toEqual({
      from: '2024-05-01T00:00:00.000Z',
      to: '2024-06-01T00:00:00.000Z',
    });
    expect(presetRange('ytd', now).from).toBe('2024-01-01T00:00:00.000Z');
    expect(presetRange('last_30', now).from).toBe('2024-05-16T00:00:00.000Z');
  });

  it('round-trips a preset back from filters', () => {
    const r = presetRange('this_month', now);
    expect(inferPreset({ date_from: r.from, date_to: r.to }, now)).toBe('this_month');
    expect(inferPreset({}, now)).toBe('all');
    expect(inferPreset({ date_from: '2024-03-03T00:00:00.000Z' }, now)).toBe('custom');
  });
});

describe('deterministic insights', () => {
  function workspace(trades: AnalyticsTrade[]): AnalyticsWorkspaceData {
    return {
      summary: {
        kpis: computeBreakdown(trades, 'symbol').reduce(
          (_acc, r) => r.kpis,
          computeBreakdown(trades, 'symbol')[0]?.kpis ?? ({ totalTrades: trades.length } as never),
        ),
        advanced: { notes: [] } as never,
        equityCurve: [],
        drawdown: {
          maxDrawdown: 0,
          maxDrawdownPct: null,
          avgDrawdown: 0,
          currentDrawdown: 0,
          maxDrawdownDurationTrades: 0,
        },
        risk: {
          avgRiskAmount: null,
          avgRiskPercent: null,
          tradesWithRisk: 0,
          tradesMissingRisk: 0,
          maxRiskAmount: null,
        },
        generatedAt: '',
      },
      breakdowns: {
        symbol: computeBreakdown(trades, 'symbol'),
        dayOfWeek: computeBreakdown(trades, 'dayOfWeek'),
        direction: computeBreakdown(trades, 'direction'),
      },
      accounts: [],
      tags: [],
      timezone: 'UTC',
    };
  }

  it('cites the strongest symbol and flags low sample size', () => {
    const trades = [t({ symbol: 'MES', net_pnl: 500 }), t({ symbol: 'NQ', net_pnl: -100 })];
    const insights = buildInsights(workspace(trades));
    const best = insights.find((i) => i.id === 'best-symbol');
    expect(best?.text).toContain('MES');
    expect(best?.metric).toContain('Net P&L');
    expect(best?.lowSample).toBe(true); // < 5 trades
  });

  it('returns no insights with no trades', () => {
    expect(buildInsights(workspace([])).length).toBe(0);
  });

  it('never emits a causal claim for mistake tags', () => {
    const data = workspace([t({ net_pnl: -100 })]);
    data.tags = [
      { id: 'x', name: 'late entry', category: 'mistake', count: 6, netPnl: -600, avgPnl: -100 },
    ];
    const insight = buildInsights(data).find((i) => i.id === 'mistake-cost');
    expect(insight?.metric).toContain('association, not cause');
  });
});
