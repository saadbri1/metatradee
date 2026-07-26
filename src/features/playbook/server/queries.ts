/**
 * Strategy/playbook reads. Owner-scoped (RLS + explicit user_id). Strategy
 * PERFORMANCE reuses the 9.8 analytics reader + KPI engine over the
 * strategy-filtered trade set, so numbers reconcile with the Analytics strategy
 * breakdown exactly (one source of truth).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAnalyticsTrades } from '@/features/analytics/server/queries';
import { computeKpis } from '@/features/analytics/kpis';
import type { Kpis } from '@/features/analytics/types';
import { computeStrategyHealth } from '../scores';
import { computeMetricsByPlaybook, EMPTY_METRICS } from '../performance';
import type { PlaybookListRow } from '../filters';
import { RULE_GROUPS, type AdherenceRecord, type StrategyRow } from '../types';

const STRATEGY_COLUMNS =
  'id, user_id, name, description, category, market, asset_class, color, symbols, timeframes, sessions, entry_rules, exit_rules, stop_loss_rules, take_profit_rules, position_sizing_rules, risk_rules, confirmation_rules, invalidation_rules, checklist, notes, status, current_version, is_pinned, is_archived, created_at, updated_at';

export async function listStrategies(
  supabase: SupabaseClient,
  userId: string,
): Promise<StrategyRow[]> {
  const { data } = await supabase
    .from('strategies')
    .select(STRATEGY_COLUMNS)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false });
  return (data as StrategyRow[] | null) ?? [];
}

export async function getStrategy(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<StrategyRow | null> {
  const { data } = await supabase
    .from('strategies')
    .select(STRATEGY_COLUMNS)
    .eq('user_id', userId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  return (data as StrategyRow | null) ?? null;
}

export async function getStrategyVersions(
  supabase: SupabaseClient,
  userId: string,
  strategyId: string,
): Promise<
  { version: number; content: unknown; change_note: string | null; created_at: string }[]
> {
  const { data } = await supabase
    .from('strategy_versions')
    .select('version, content, change_note, created_at')
    .eq('user_id', userId)
    .eq('strategy_id', strategyId)
    .order('version', { ascending: false });
  return (data as never) ?? [];
}

export interface StrategyPerformance {
  kpis: Kpis;
  health: number | null;
}

/** Per-strategy performance via the 9.8 engine (reconciles with Analytics). */
export async function getStrategyPerformance(
  supabase: SupabaseClient,
  userId: string,
  strategyId: string,
): Promise<StrategyPerformance> {
  const trades = await fetchAnalyticsTrades(supabase, userId, { strategy_id: strategyId });
  const kpis = computeKpis(trades);
  return { kpis, health: computeStrategyHealth(kpis) };
}

export interface PlaybookWorkspaceData {
  rows: PlaybookListRow[];
  /** Every category actually used by the user's playbooks (for the filter). */
  categories: string[];
  /** Every symbol actually traded under a playbook (for the filter). */
  symbols: string[];
  /** True when `trades.reviewed` is readable — gates the Reviewed column. */
  reviewedAvailable: boolean;
}

function ruleCount(strategy: StrategyRow): number {
  return RULE_GROUPS.reduce((total, group) => total + (strategy[group]?.length ?? 0), 0);
}

/**
 * The whole Playbook list in ONE trade read.
 *
 * Metrics come from the shared 9.8 engine over the user's trade set grouped by
 * `strategy_id`, so a playbook's Net P&L reconciles exactly with the Analytics
 * strategy breakdown. Reading every strategy's trades separately would be an
 * N+1; this reads once and groups in memory.
 */
export async function getPlaybookWorkspace(
  supabase: SupabaseClient,
  userId: string,
): Promise<PlaybookWorkspaceData> {
  const [strategies, trades] = await Promise.all([
    listStrategies(supabase, userId),
    fetchAnalyticsTrades(supabase, userId),
  ]);

  const metricsById = computeMetricsByPlaybook(trades);
  const rows: PlaybookListRow[] = strategies.map((strategy) => ({
    id: strategy.id,
    name: strategy.name,
    description: strategy.description,
    category: strategy.category,
    status: strategy.status,
    symbols: strategy.symbols ?? [],
    timeframes: strategy.timeframes ?? [],
    sessions: strategy.sessions ?? [],
    is_pinned: strategy.is_pinned,
    current_version: strategy.current_version,
    rule_count: ruleCount(strategy),
    checklist_count: strategy.checklist?.length ?? 0,
    updated_at: strategy.updated_at,
    created_at: strategy.created_at,
    metrics: metricsById.get(strategy.id) ?? EMPTY_METRICS,
  }));

  const categories = [
    ...new Set(strategies.map((s) => s.category).filter((c): c is string => Boolean(c))),
  ].sort();
  const symbols = [...new Set(rows.flatMap((row) => row.metrics.symbols))].sort();

  return {
    rows,
    categories,
    symbols,
    reviewedAvailable: trades.some((trade) => typeof trade.reviewed === 'boolean'),
  };
}

/** Real closed/open trades linked to one playbook, newest first. */
export async function getPlaybookTrades(
  supabase: SupabaseClient,
  userId: string,
  strategyId: string,
  limit = 25,
) {
  const { data } = await supabase
    .from('trades')
    .select(
      'id, symbol, direction, net_pnl, rr_ratio, quantity, opened_at, closed_at, duration_seconds, setup',
    )
    .eq('user_id', userId)
    .eq('strategy_id', strategyId)
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('closed_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data as PlaybookTradeRow[] | null) ?? [];
}

export interface PlaybookTradeRow {
  id: string;
  symbol: string;
  direction: 'buy' | 'sell';
  net_pnl: number | null;
  rr_ratio: number | null;
  quantity: number | null;
  opened_at: string | null;
  closed_at: string | null;
  duration_seconds: number | null;
  setup: string | null;
}

/**
 * Rule-level adherence actually recorded against this playbook's trades. Used
 * to decide between real adherence figures and a precise locked state — it is
 * never synthesised.
 */
export async function getPlaybookAdherence(
  supabase: SupabaseClient,
  userId: string,
  strategyId: string,
): Promise<AdherenceRecord[]> {
  const { data } = await supabase
    .from('trade_strategy_adherence')
    .select(
      'trade_id, strategy_id, strategy_version, followed_strategy, checklist_completed_pct, rule_violations, execution_quality, confidence, mistakes, lessons',
    )
    .eq('user_id', userId)
    .eq('strategy_id', strategyId);
  return (data as AdherenceRecord[] | null) ?? [];
}

export async function listPlaybooks(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('playbooks')
    .select('id, name, description, category, is_favorite, status, created_at, updated_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('is_favorite', { ascending: false })
    .order('updated_at', { ascending: false });
  return data ?? [];
}
