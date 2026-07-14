/**
 * Analytics DTOs — stable, serializable shapes (export-ready seam: a future
 * export/API layer consumes these unchanged; this phase only PREPARES them).
 * `AnalyticsTrade` is the minimal normalized trade the engine consumes; it is
 * derived from the 9.6 `trades` row (no recomputation of PnL/RR).
 */
import type { Direction, TradeSession, TradeSource } from '@/features/journal/enums';

export interface AnalyticsTrade {
  id: string;
  net_pnl: number | null;
  pnl: number | null;
  rr_ratio: number | null;
  quantity: number | null;
  position_size: number | null;
  risk_amount: number | null;
  risk_percent: number | null;
  direction: Direction;
  symbol: string;
  market: string | null;
  asset_type: string | null;
  session: TradeSession | null;
  strategy_id: string | null;
  broker_id: string | null;
  trading_account_id: string | null;
  source: TradeSource;
  opened_at: string | null;
  closed_at: string | null;
  duration_seconds: number | null;
}

export interface Kpis {
  totalTrades: number;
  wins: number;
  losses: number;
  breakEven: number;
  winRate: number | null;
  lossRate: number | null;
  breakEvenRate: number | null;
  grossProfit: number;
  grossLoss: number;
  netProfit: number;
  profitFactor: number | null;
  expectancy: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  largestWin: number | null;
  largestLoss: number | null;
  avgRr: number | null;
  avgHoldingSeconds: number | null;
  totalVolume: number;
  avgPositionSize: number | null;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  tradingDays: number;
  avgTradesPerDay: number | null;
}

export interface AdvancedMetrics {
  sharpe: number | null;
  sortino: number | null;
  calmar: number | null;
  expectancyScore: number | null;
  profitConsistency: number | null; // % of profitable trading days
  tradeEfficiency: number | null; // requires MFE/MAE — null until captured
  avgMfe: number | null; // requires excursion data — null until captured
  avgMae: number | null; // requires excursion data — null until captured
  edgeRatio: number | null; // requires MFE/MAE — null until captured
  recoveryFactor: number | null;
  riskOfRuin: number | null;
  kelly: number | null;
  /** Notes on assumptions/what could not be computed (surfaced in UI). */
  notes: string[];
}

export interface EquityPoint {
  index: number;
  closed_at: string | null;
  equity: number; // cumulative realized net P&L (basis documented)
  drawdown: number; // <= 0, distance below running peak
}

export interface DrawdownStats {
  maxDrawdown: number; // absolute magnitude (>= 0)
  maxDrawdownPct: number | null; // vs running peak
  avgDrawdown: number;
  currentDrawdown: number;
  maxDrawdownDurationTrades: number;
}

export interface RiskStats {
  avgRiskAmount: number | null;
  avgRiskPercent: number | null;
  tradesWithRisk: number;
  tradesMissingRisk: number;
  maxRiskAmount: number | null;
}

export interface BreakdownRow<K extends string = string> {
  key: K;
  label: string;
  kpis: Kpis;
}

export interface AnalyticsSummary {
  kpis: Kpis;
  advanced: AdvancedMetrics;
  equityCurve: EquityPoint[];
  drawdown: DrawdownStats;
  risk: RiskStats;
  generatedAt: string;
}

export type BreakdownDimension =
  | 'broker'
  | 'account'
  | 'strategy'
  | 'market'
  | 'asset'
  | 'symbol'
  | 'session'
  | 'dayOfWeek'
  | 'hourOfDay'
  | 'month'
  | 'quarter'
  | 'year'
  | 'direction'
  | 'source';
