/** Goals/habits/psychology domain types. */
export type GoalType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
export type GoalMetric =
  | 'max_daily_loss'
  | 'max_trades_per_day'
  | 'win_rate'
  | 'avg_rr'
  | 'profit_target'
  | 'drawdown_limit'
  | 'consistency'
  | 'trading_days'
  | 'habit'
  | 'custom';
export type GoalDirection = 'gte' | 'lte';
export type GoalStatus = 'active' | 'completed' | 'failed' | 'archived';

export interface GoalRow {
  id: string;
  user_id: string;
  name: string;
  goal_type: GoalType;
  metric: GoalMetric;
  target_value: number;
  direction: GoalDirection;
  period_start: string | null;
  period_end: string | null;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
}

export type HabitType =
  | 'pre_market'
  | 'journal'
  | 'review'
  | 'meditation'
  | 'sleep'
  | 'exercise'
  | 'rule_compliance'
  | 'custom';

export interface HabitRow {
  id: string;
  user_id: string;
  name: string;
  habit_type: HabitType;
  cadence: 'daily' | 'weekly';
  target_per_week: number;
  freeze_tokens: number;
  is_active: boolean;
}

export interface HabitLog {
  log_date: string; // YYYY-MM-DD (tz-correct per 9.9)
  completed: boolean;
  is_rest_day: boolean;
}

export type TradePhase = 'before' | 'during' | 'after' | 'general';

export interface PsychologyEntry {
  id: string;
  trade_id: string | null;
  phase: TradePhase;
  emotion: string | null;
  confidence: number | null;
  stress: number | null;
  focus: number | null;
  discipline: number | null;
  motivation: number | null;
  energy: number | null;
  notes: string | null; // PRIVATE — never exposed via any shared view
  entry_date: string;
}

export interface ActionResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}
