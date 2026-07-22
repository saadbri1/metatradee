import type { AnalyticsTrade, Kpis } from '@/features/analytics/types';
import type { AccountType, TradingAccount } from '@/features/accounts/types';

export type DateRangePreset =
  | 'all'
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'previous_month'
  | 'last_30'
  | 'last_90'
  | 'custom';

export interface DashboardTrade extends AnalyticsTrade {
  entry_price: number | null;
  exit_price: number | null;
  currency: string;
  notes: string | null;
  created_at: string;
}

export interface DashboardFilters {
  accountIds: string[];
  accountTypes: AccountType[];
  dateRange: DateRangePreset;
  customStart: string | null;
  customEnd: string | null;
  symbols: string[];
  sides: Array<'buy' | 'sell'>;
  sources: Array<'manual' | 'imported'>;
  result: 'all' | 'profitable' | 'losing' | 'break_even';
}

export interface DailyPnlPoint {
  dateKey: string;
  netPnl: number;
  tradeCount: number;
  hasNotes: boolean;
  cumulative: number;
}

export interface DashboardScore {
  value: number | null;
  minimumTrades: number;
  components: {
    winRate: number | null;
    profitFactor: number | null;
    payoff: number | null;
    consistency: number | null;
  };
}

export interface DashboardPerformanceMetrics {
  /** Winning closed trades / all closed trades with a recorded net P&L. Break-even is eligible. */
  winningTradePercentage: number | null;
  /** Profitable trading days / days containing an eligible closed trade. Flat days are eligible. */
  winningDayPercentage: number | null;
  profitableDays: number;
  losingDays: number;
  flatDays: number;
  eligibleTradingDays: number;
  averageWinningTrade: number | null;
  /** Signed negative realized P&L; null when there are no losing closed trades. */
  averageLosingTrade: number | null;
  averageWinLossRatio: number | null;
}

export interface DashboardProjection {
  filteredTrades: DashboardTrade[];
  closedTrades: DashboardTrade[];
  openTrades: DashboardTrade[];
  recentTrades: DashboardTrade[];
  kpis: Kpis;
  daily: DailyPnlPoint[];
  performance: DashboardPerformanceMetrics;
  averageWinLossRatio: number | null;
  score: DashboardScore;
}

export interface DashboardData {
  accounts: TradingAccount[];
  trades: DashboardTrade[];
  lastImportAt: string | null;
  lastImportStatus: string | null;
  timezone: string;
}
