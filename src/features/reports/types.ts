/**
 * Reports domain types. A report is a DEFINITION (blocks + filters + scope) that
 * is rendered by copying figures out of the existing engines (9.8–9.12). No
 * report type recomputes analytics/AI math — reconciliation holds because the
 * numbers are the engines' own outputs, passed through unchanged.
 */
import type { TradeFilters } from '@/features/journal/filters';

export type ReportType =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'custom'
  | 'strategy'
  | 'broker'
  | 'account'
  | 'session'
  | 'symbol'
  | 'risk'
  | 'psychology'
  | 'goal_progress'
  | 'ai_performance'
  | 'executive';

/** Content blocks — each owned by exactly one engine (no duplicated logic). */
export type BlockKind =
  | 'kpis'
  | 'equity_curve'
  | 'balance_curve'
  | 'drawdown'
  | 'risk'
  | 'trade_distribution'
  | 'session_performance'
  | 'calendar_heatmap'
  | 'strategy_performance'
  | 'goal_progress'
  | 'habit_tracking'
  | 'psychology' // SENSITIVE — never in a public/opt-out share
  | 'ai_insights'
  | 'rule_violations'
  | 'notes';

/** Blocks that carry sensitive psychology data (9.11). Gated in shares/exports. */
export const SENSITIVE_BLOCKS: ReadonlySet<BlockKind> = new Set(['psychology', 'habit_tracking']);

export type ExportFormat = 'pdf' | 'csv' | 'xlsx' | 'json' | 'print';

export interface ReportDefinition {
  type: ReportType;
  title: string;
  blocks: BlockKind[];
  filters: TradeFilters;
  /** Free-text user note rendered into the report (sanitized on output). */
  note?: string;
}

/** A resolved block: engine data copied in, ready to render. `data` is opaque. */
export interface RenderedBlock {
  kind: BlockKind;
  title: string;
  /** Present true only for blocks derived from sensitive psychology data. */
  sensitive: boolean;
  data: unknown;
}

export interface RenderedReport {
  type: ReportType;
  title: string;
  filters: TradeFilters;
  blocks: RenderedBlock[];
  note?: string;
  generatedAt: string;
}

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

export interface ShareConfig {
  allowDownload: boolean;
  isPublic: boolean;
  /** Explicit per-report opt-in to include psychology blocks. Never for public. */
  includePsychology: boolean;
  expiresAt: string | null;
  hasPassword: boolean;
}
