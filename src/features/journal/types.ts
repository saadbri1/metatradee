/** Journal domain types + the shared action-result contract. */
import type {
  AssetType,
  Direction,
  TradeSession,
  TradeStatus,
  TradeVisibility,
  TradeSource,
} from './enums';

export type ActionResult<T = undefined> =
  { ok: true; data?: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** A trade row as read from the DB (private_notes omitted from list views). */
export interface TradeRow {
  id: string;
  user_id: string;
  trading_account_id: string | null;
  broker_id: string | null;
  strategy_id: string | null;
  market: string | null;
  symbol: string;
  asset_type: AssetType | null;
  direction: Direction;
  entry_price: number | null;
  exit_price: number | null;
  quantity: number | null;
  position_size: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  risk_percent: number | null;
  risk_amount: number | null;
  reward: number | null;
  rr_ratio: number | null;
  commission: number;
  swap: number;
  fees: number;
  pnl: number | null;
  net_pnl: number | null;
  currency: string;
  opened_at: string | null;
  closed_at: string | null;
  executed_at: string | null;
  duration_seconds: number | null;
  session: TradeSession | null;
  setup: string | null;
  confidence: number | null;
  notes: string | null;
  visibility: TradeVisibility;
  status: TradeStatus;
  source: TradeSource;
  is_favorite: boolean;
  is_pinned: boolean;
  /**
   * Journal review state. Backed by the trades.reviewed column
   * (20260723120000_trade_reviewed). Defaults to false when the column has
   * not been applied yet, so reads never break — see listTrades.
   */
  reviewed: boolean;
  created_at: string;
  updated_at: string;
}

/** A tag as shown in the Trade Log (real, from the tags table). */
export interface TradeTag {
  id: string;
  name: string;
  category: 'setup' | 'mistake' | 'emotion' | 'custom';
  color: string | null;
}

/** A trade row plus its resolved tags, for the list/table. */
export interface TradeListRow extends TradeRow {
  tags: TradeTag[];
}

export interface TradePage {
  items: TradeListRow[];
  nextCursor: string | null;
}

/** Aggregate summary for the Journal KPI row over the filtered set. */
export interface JournalSummary {
  totalTrades: number;
  decidedTrades: number;
  netProfit: number;
  profitFactor: number | null;
  winRate: number | null;
  wins: number;
  losses: number;
  breakEven: number;
  avgWin: number | null;
  avgLoss: number | null;
  currency: string;
}

export interface DuplicateWarning {
  verdict: 'full' | 'partial';
  existingId?: string;
}
