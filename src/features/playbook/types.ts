/** Playbook/strategy domain types. Performance metrics are 9.8 `Kpis` (reused). */

export type StrategyStatus = 'draft' | 'active' | 'archived';

export interface RuleItem {
  id: string;
  text: string;
  required?: boolean;
}

export interface ChecklistItem {
  id: string;
  text: string;
  required: boolean;
  position?: number;
}

/** The rule-group keys stored as typed JSONB arrays on `strategies`. */
export const RULE_GROUPS = [
  'entry_rules',
  'exit_rules',
  'stop_loss_rules',
  'take_profit_rules',
  'position_sizing_rules',
  'risk_rules',
  'confirmation_rules',
  'invalidation_rules',
] as const;
export type RuleGroup = (typeof RULE_GROUPS)[number];

export interface StrategyRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string | null;
  market: string | null;
  asset_class: string | null;
  color: string | null;
  symbols: string[];
  timeframes: string[];
  sessions: string[];
  entry_rules: RuleItem[];
  exit_rules: RuleItem[];
  stop_loss_rules: RuleItem[];
  take_profit_rules: RuleItem[];
  position_sizing_rules: RuleItem[];
  risk_rules: RuleItem[];
  confirmation_rules: RuleItem[];
  invalidation_rules: RuleItem[];
  checklist: ChecklistItem[];
  notes: string | null;
  status: StrategyStatus;
  current_version: number;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdherenceRecord {
  trade_id: string;
  strategy_id: string | null;
  strategy_version: number | null;
  followed_strategy: boolean | null;
  checklist_completed_pct: number | null;
  rule_violations: string[];
  execution_quality: number | null;
  confidence: number | null;
  mistakes: string[];
  lessons: string | null;
}

export interface ActionResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}
