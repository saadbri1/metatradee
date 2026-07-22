import { describe, expect, it } from 'vitest';
import type { TradingAccount } from '@/features/accounts/types';
import {
  buildDashboardProjection,
  calculateTrackedBalance,
  computeDashboardPerformanceMetrics,
  EMPTY_DASHBOARD_FILTERS,
  filterDashboardTrades,
  resolveDateRange,
} from '@/features/dashboard/projection';
import type { DashboardTrade } from '@/features/dashboard/types';

function account(
  id: string,
  account_type: TradingAccount['account_type'],
  starting_balance = 10_000,
): TradingAccount {
  return {
    id,
    user_id: 'user-1',
    name: `${account_type} account`,
    account_type,
    provider: account_type === 'demo' ? null : 'File provider',
    external_account_identifier: null,
    base_currency: 'USD',
    starting_balance,
    account_size: account_type === 'funded' ? starting_balance : null,
    status: 'active',
    connection_method: account_type === 'demo' ? 'simulation' : 'file',
    import_status: 'ready',
    last_successful_import_at: null,
    is_default: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function trade(over: Partial<DashboardTrade> = {}): DashboardTrade {
  return {
    id: over.id ?? crypto.randomUUID(),
    net_pnl: over.net_pnl ?? 0,
    pnl: over.pnl ?? over.net_pnl ?? 0,
    rr_ratio: over.rr_ratio ?? null,
    quantity: over.quantity ?? 1,
    position_size: over.position_size ?? null,
    risk_amount: over.risk_amount ?? null,
    risk_percent: over.risk_percent ?? null,
    direction: over.direction ?? 'buy',
    symbol: over.symbol ?? 'AAPL',
    market: over.market ?? null,
    asset_type: over.asset_type ?? null,
    session: over.session ?? null,
    strategy_id: over.strategy_id ?? null,
    broker_id: over.broker_id ?? null,
    trading_account_id: over.trading_account_id ?? 'demo-id',
    source: over.source ?? 'manual',
    opened_at: over.opened_at ?? '2026-01-02T14:00:00Z',
    closed_at: over.closed_at === undefined ? '2026-01-02T15:00:00Z' : over.closed_at,
    duration_seconds: over.duration_seconds ?? 3600,
    entry_price: over.entry_price ?? 100,
    exit_price: over.exit_price ?? 101,
    currency: over.currency ?? 'USD',
    notes: over.notes ?? null,
    created_at: over.created_at ?? '2026-01-02T14:00:00Z',
  };
}

const accounts = [
  account('demo-id', 'demo'),
  account('broker-id', 'broker'),
  account('funded-id', 'funded'),
];

describe('dashboard account and date filters', () => {
  const trades = [
    trade({ id: 'd', trading_account_id: 'demo-id', symbol: 'AAPL', net_pnl: 100 }),
    trade({ id: 'b', trading_account_id: 'broker-id', symbol: 'MSFT', net_pnl: -40 }),
    trade({ id: 'f', trading_account_id: 'funded-id', symbol: 'ES', net_pnl: 20 }),
  ];

  it('supports one, several, all, and account-type selections', () => {
    expect(filterDashboardTrades(trades, accounts, EMPTY_DASHBOARD_FILTERS, 'UTC')).toHaveLength(3);
    expect(
      filterDashboardTrades(
        trades,
        accounts,
        { ...EMPTY_DASHBOARD_FILTERS, accountIds: ['demo-id'] },
        'UTC',
      ).map((t) => t.id),
    ).toEqual(['d']);
    expect(
      filterDashboardTrades(
        trades,
        accounts,
        { ...EMPTY_DASHBOARD_FILTERS, accountIds: ['demo-id', 'funded-id'] },
        'UTC',
      ).map((t) => t.id),
    ).toEqual(['d', 'f']);
    expect(
      filterDashboardTrades(
        trades,
        accounts,
        { ...EMPTY_DASHBOARD_FILTERS, accountTypes: ['broker'] },
        'UTC',
      ).map((t) => t.id),
    ).toEqual(['b']);
  });

  it('applies symbols, side, source, and result from one shared filter object', () => {
    const result = filterDashboardTrades(
      trades,
      accounts,
      {
        ...EMPTY_DASHBOARD_FILTERS,
        symbols: ['MSFT'],
        sides: ['buy'],
        sources: ['manual'],
        result: 'losing',
      },
      'UTC',
    );
    expect(result.map((item) => item.id)).toEqual(['b']);
  });

  it('uses the workspace timezone at midnight boundaries', () => {
    const boundary = trade({ id: 'boundary', closed_at: '2026-01-02T00:30:00Z' });
    const filters = {
      ...EMPTY_DASHBOARD_FILTERS,
      dateRange: 'custom' as const,
      customStart: '2026-01-01',
      customEnd: '2026-01-01',
    };
    expect(filterDashboardTrades([boundary], accounts, filters, 'America/New_York')).toHaveLength(
      1,
    );
    expect(filterDashboardTrades([boundary], accounts, filters, 'UTC')).toHaveLength(0);
    expect(
      resolveDateRange('today', new Date('2026-01-02T00:30:00Z'), null, null, 'America/New_York'),
    ).toEqual({ start: '2026-01-01', end: '2026-01-01' });
  });
});

describe('dashboard analytics projection', () => {
  it('reconciles KPI, break-even, daily, and cumulative calculations', () => {
    const projection = buildDashboardProjection(
      [
        trade({ id: '1', net_pnl: 100, closed_at: '2026-01-01T12:00:00Z', notes: 'Plan' }),
        trade({ id: '2', net_pnl: -40, closed_at: '2026-01-01T15:00:00Z' }),
        trade({ id: '3', net_pnl: 0, closed_at: '2026-01-02T15:00:00Z' }),
      ],
      accounts,
      EMPTY_DASHBOARD_FILTERS,
      'UTC',
    );
    expect(projection.kpis).toMatchObject({
      totalTrades: 3,
      netProfit: 60,
      expectancy: 20,
      profitFactor: 2.5,
      winRate: 0.3333,
      breakEven: 1,
    });
    expect(projection.daily).toEqual([
      { dateKey: '2026-01-01', netPnl: 60, tradeCount: 2, hasNotes: true, cumulative: 60 },
      { dateKey: '2026-01-02', netPnl: 0, tradeCount: 1, hasNotes: false, cumulative: 60 },
    ]);
    expect(projection.averageWinLossRatio).toBe(2.5);
    expect(projection.performance).toEqual({
      winningTradePercentage: 0.3333,
      winningDayPercentage: 0.5,
      profitableDays: 1,
      losingDays: 0,
      flatDays: 1,
      eligibleTradingDays: 2,
      averageWinningTrade: 100,
      averageLosingTrade: -40,
      averageWinLossRatio: 2.5,
    });
  });

  it('returns honest null states for no trades and zero losses', () => {
    const empty = buildDashboardProjection([], accounts, EMPTY_DASHBOARD_FILTERS, 'UTC');
    expect(empty.kpis).toMatchObject({
      totalTrades: 0,
      expectancy: null,
      profitFactor: null,
      winRate: null,
    });
    expect(empty.daily).toEqual([]);
    expect(empty.performance).toMatchObject({
      winningTradePercentage: null,
      winningDayPercentage: null,
      profitableDays: 0,
      losingDays: 0,
      flatDays: 0,
      eligibleTradingDays: 0,
      averageWinningTrade: null,
      averageLosingTrade: null,
    });
    expect(empty.score.value).toBeNull();
    const winners = buildDashboardProjection(
      [trade({ net_pnl: 25 })],
      accounts,
      EMPTY_DASHBOARD_FILTERS,
      'UTC',
    );
    expect(winners.kpis.profitFactor).toBeNull();
    expect(winners.averageWinLossRatio).toBeNull();
  });

  it('uses profitable days over eligible trade days while retaining flat days', () => {
    const projection = buildDashboardProjection(
      [
        trade({ id: 'win', net_pnl: 90, closed_at: '2026-02-01T10:00:00Z' }),
        trade({ id: 'loss', net_pnl: -30, closed_at: '2026-02-02T10:00:00Z' }),
        trade({ id: 'flat-a', net_pnl: 20, closed_at: '2026-02-03T10:00:00Z' }),
        trade({ id: 'flat-b', net_pnl: -20, closed_at: '2026-02-03T15:00:00Z' }),
      ],
      accounts,
      EMPTY_DASHBOARD_FILTERS,
      'UTC',
    );

    expect(projection.performance).toMatchObject({
      winningTradePercentage: 0.5,
      winningDayPercentage: 0.3333,
      profitableDays: 1,
      losingDays: 1,
      flatDays: 1,
      eligibleTradingDays: 3,
      averageWinningTrade: 55,
      averageLosingTrade: -25,
    });
  });

  it('uses the workspace timezone when forming eligible trading days', () => {
    const boundaryTrades = [
      trade({ id: 'late-win', net_pnl: 100, closed_at: '2026-01-02T00:30:00Z' }),
      trade({ id: 'early-loss', net_pnl: -60, closed_at: '2026-01-01T23:30:00Z' }),
    ];
    const utc = buildDashboardProjection(boundaryTrades, accounts, EMPTY_DASHBOARD_FILTERS, 'UTC');
    const newYork = buildDashboardProjection(
      boundaryTrades,
      accounts,
      EMPTY_DASHBOARD_FILTERS,
      'America/New_York',
    );

    expect(utc.performance).toMatchObject({
      winningDayPercentage: 0.5,
      profitableDays: 1,
      losingDays: 1,
      eligibleTradingDays: 2,
    });
    expect(newYork.performance).toMatchObject({
      winningDayPercentage: 1,
      profitableDays: 1,
      losingDays: 0,
      eligibleTradingDays: 1,
    });
  });

  it('derives averages and break-even policy only from filtered closed trades', () => {
    const projection = buildDashboardProjection(
      [
        trade({ id: 'demo-win', trading_account_id: 'demo-id', net_pnl: 120 }),
        trade({ id: 'demo-flat', trading_account_id: 'demo-id', net_pnl: 0 }),
        trade({ id: 'broker-loss', trading_account_id: 'broker-id', net_pnl: -80 }),
      ],
      accounts,
      { ...EMPTY_DASHBOARD_FILTERS, accountIds: ['demo-id'] },
      'UTC',
    );

    expect(projection.performance).toMatchObject({
      winningTradePercentage: 0.5,
      winningDayPercentage: 1,
      averageWinningTrade: 120,
      averageLosingTrade: null,
    });
    expect(projection.closedTrades.map((item) => item.id)).toEqual(['demo-win', 'demo-flat']);
  });

  it('applies date filters before calculating trade/day rates and averages', () => {
    const projection = buildDashboardProjection(
      [
        trade({ id: 'inside-win', net_pnl: 50, closed_at: '2026-03-10T12:00:00Z' }),
        trade({ id: 'outside-loss', net_pnl: -500, closed_at: '2026-03-11T12:00:00Z' }),
      ],
      accounts,
      {
        ...EMPTY_DASHBOARD_FILTERS,
        dateRange: 'custom',
        customStart: '2026-03-10',
        customEnd: '2026-03-10',
      },
      'UTC',
    );

    expect(projection.performance).toMatchObject({
      winningTradePercentage: 1,
      winningDayPercentage: 1,
      averageWinningTrade: 50,
      averageLosingTrade: null,
    });
  });

  it('keeps the performance helper pure and empty-safe', () => {
    const metrics = computeDashboardPerformanceMetrics(
      {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        breakEven: 0,
        winRate: null,
        lossRate: null,
        breakEvenRate: null,
        grossProfit: 0,
        grossLoss: 0,
        netProfit: 0,
        profitFactor: null,
        expectancy: null,
        avgWin: null,
        avgLoss: null,
        largestWin: null,
        largestLoss: null,
        avgRr: null,
        avgHoldingSeconds: null,
        totalVolume: 0,
        avgPositionSize: null,
        maxConsecutiveWins: 0,
        maxConsecutiveLosses: 0,
        tradingDays: 0,
        avgTradesPerDay: null,
      },
      [],
    );
    expect(metrics.winningTradePercentage).toBeNull();
    expect(metrics.winningDayPercentage).toBeNull();
  });

  it('separates open positions and unlocks the real score only after sufficient data', () => {
    const closed = Array.from({ length: 20 }, (_, index) =>
      trade({
        id: `c-${index}`,
        net_pnl: index % 3 === 0 ? -25 : 50,
        closed_at: `2026-01-${String(index + 1).padStart(2, '0')}T12:00:00Z`,
      }),
    );
    const open = trade({ id: 'open', closed_at: null, net_pnl: null });
    const projection = buildDashboardProjection(
      [...closed, open],
      accounts,
      EMPTY_DASHBOARD_FILTERS,
      'UTC',
    );
    expect(projection.openTrades.map((item) => item.id)).toEqual(['open']);
    expect(projection.score.value).not.toBeNull();
  });

  it('aggregates starting balance with only selected realized account P&L', () => {
    expect(
      calculateTrackedBalance(accounts.slice(0, 2), [
        trade({ trading_account_id: 'demo-id', net_pnl: 100 }),
        trade({ trading_account_id: 'broker-id', net_pnl: -40 }),
        trade({ trading_account_id: 'funded-id', net_pnl: 999 }),
      ]),
    ).toBe(20_060);
  });
});
