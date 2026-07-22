import { computeKpis } from '@/features/analytics/kpis';
import { buildDailyCalendar } from '@/features/calendar/calendar';
import { tzParts } from '@/features/calendar/time';
import type { TradingAccount } from '@/features/accounts/types';
import type {
  DashboardFilters,
  DashboardProjection,
  DashboardScore,
  DashboardTrade,
  DateRangePreset,
  DailyPnlPoint,
} from './types';

export const EMPTY_DASHBOARD_FILTERS: DashboardFilters = {
  accountIds: [],
  accountTypes: [],
  dateRange: 'all',
  customStart: null,
  customEnd: null,
  symbols: [],
  sides: [],
  sources: [],
  result: 'all',
};

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function resolveDateRange(
  preset: DateRangePreset,
  now = new Date(),
  customStart: string | null = null,
  customEnd: string | null = null,
  timezone = 'UTC',
): { start: string | null; end: string | null } {
  const localDateKey = tzParts(now.toISOString(), timezone)?.dateKey ?? dateKey(now);
  const [year, month, day] = localDateKey.split('-').map(Number);
  const end = new Date(Date.UTC(year!, month! - 1, day!));
  const start = new Date(end);
  if (preset === 'all') return { start: null, end: null };
  if (preset === 'custom') return { start: customStart, end: customEnd };
  if (preset === 'today') return { start: dateKey(start), end: dateKey(end) };
  if (preset === 'this_week') {
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  } else if (preset === 'this_month') {
    start.setUTCDate(1);
  } else if (preset === 'previous_month') {
    start.setUTCMonth(start.getUTCMonth() - 1, 1);
    end.setUTCDate(0);
  } else if (preset === 'last_30') {
    start.setUTCDate(start.getUTCDate() - 29);
  } else if (preset === 'last_90') {
    start.setUTCDate(start.getUTCDate() - 89);
  }
  return { start: dateKey(start), end: dateKey(end) };
}

function inResult(trade: DashboardTrade, result: DashboardFilters['result']): boolean {
  if (result === 'all') return true;
  if (trade.net_pnl === null) return false;
  if (result === 'profitable') return trade.net_pnl > 0;
  if (result === 'losing') return trade.net_pnl < 0;
  return trade.net_pnl === 0;
}

export function filterDashboardTrades(
  trades: DashboardTrade[],
  accounts: TradingAccount[],
  filters: DashboardFilters,
  timezone: string,
  now = new Date(),
): DashboardTrade[] {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const range = resolveDateRange(
    filters.dateRange,
    now,
    filters.customStart,
    filters.customEnd,
    timezone,
  );
  return trades.filter((trade) => {
    const account = trade.trading_account_id ? accountById.get(trade.trading_account_id) : null;
    if (
      filters.accountIds.length > 0 &&
      !filters.accountIds.includes(trade.trading_account_id ?? '')
    )
      return false;
    if (
      filters.accountTypes.length > 0 &&
      (!account || !filters.accountTypes.includes(account.account_type))
    )
      return false;
    if (filters.symbols.length > 0 && !filters.symbols.includes(trade.symbol)) return false;
    if (filters.sides.length > 0 && !filters.sides.includes(trade.direction)) return false;
    if (filters.sources.length > 0 && !filters.sources.includes(trade.source)) return false;
    if (!inResult(trade, filters.result)) return false;
    const relevantAt = trade.closed_at ?? trade.opened_at;
    const key = relevantAt ? (tzParts(relevantAt, timezone)?.dateKey ?? null) : null;
    if (range.start && (!key || key < range.start)) return false;
    if (range.end && (!key || key > range.end)) return false;
    return true;
  });
}

export function buildDailyPnl(trades: DashboardTrade[], timezone: string): DailyPnlPoint[] {
  const calendar = buildDailyCalendar(trades, timezone);
  let cumulative = 0;
  return calendar.map((day) => {
    cumulative = Math.round((cumulative + day.kpis.netProfit) * 100) / 100;
    const members = trades.filter(
      (trade) => trade.closed_at && tzParts(trade.closed_at, timezone)?.dateKey === day.dateKey,
    );
    return {
      dateKey: day.dateKey,
      netPnl: day.kpis.netProfit,
      tradeCount: day.kpis.totalTrades,
      hasNotes: members.some((trade) => Boolean(trade.notes?.trim())),
      cumulative,
    };
  });
}

export function computeDashboardScore(
  kpis: ReturnType<typeof computeKpis>,
  daily: DailyPnlPoint[],
): DashboardScore {
  const minimumTrades = 20;
  const profitableDays = daily.filter((day) => day.netPnl > 0).length;
  const components = {
    winRate: kpis.winRate === null ? null : Math.min(100, (kpis.winRate / 0.6) * 100),
    profitFactor: kpis.profitFactor === null ? null : Math.min(100, (kpis.profitFactor / 2) * 100),
    payoff:
      kpis.avgWin === null || kpis.avgLoss === null || kpis.avgLoss === 0
        ? null
        : Math.min(100, (kpis.avgWin / kpis.avgLoss / 2) * 100),
    consistency: daily.length === 0 ? null : (profitableDays / daily.length) * 100,
  };
  const values = Object.values(components).filter((value): value is number => value !== null);
  const value =
    kpis.totalTrades >= minimumTrades && values.length === 4
      ? Math.round(values.reduce((sum, component) => sum + component, 0) / values.length)
      : null;
  return { value, minimumTrades, components };
}

/** Starting balances plus filtered realized P&L. Never includes unpriced open positions. */
export function calculateTrackedBalance(
  accounts: TradingAccount[],
  closedTrades: DashboardTrade[],
): number {
  const pnlByAccount = new Map<string, number>();
  for (const trade of closedTrades) {
    if (!trade.trading_account_id) continue;
    pnlByAccount.set(
      trade.trading_account_id,
      (pnlByAccount.get(trade.trading_account_id) ?? 0) + (trade.net_pnl ?? 0),
    );
  }
  return accounts.reduce(
    (total, account) => total + account.starting_balance + (pnlByAccount.get(account.id) ?? 0),
    0,
  );
}

export function buildDashboardProjection(
  trades: DashboardTrade[],
  accounts: TradingAccount[],
  filters: DashboardFilters,
  timezone: string,
  now = new Date(),
): DashboardProjection {
  const filteredTrades = filterDashboardTrades(trades, accounts, filters, timezone, now);
  const closedTrades = filteredTrades.filter(
    (trade) => Boolean(trade.closed_at) && trade.net_pnl !== null,
  );
  const openTrades = filteredTrades.filter((trade) => Boolean(trade.opened_at) && !trade.closed_at);
  const recentTrades = [...closedTrades]
    .sort((a, b) => Date.parse(b.closed_at ?? '') - Date.parse(a.closed_at ?? ''))
    .slice(0, 8);
  const kpis = computeKpis(closedTrades);
  const daily = buildDailyPnl(closedTrades, timezone);
  const averageWinLossRatio =
    kpis.avgWin !== null && kpis.avgLoss !== null && kpis.avgLoss > 0
      ? Math.round((kpis.avgWin / kpis.avgLoss) * 100) / 100
      : null;
  return {
    filteredTrades,
    closedTrades,
    openTrades,
    recentTrades,
    kpis,
    daily,
    averageWinLossRatio,
    score: computeDashboardScore(kpis, daily),
  };
}
