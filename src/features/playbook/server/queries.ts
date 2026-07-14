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
import type { StrategyRow } from '../types';

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
