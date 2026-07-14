/**
 * Analytics reads. Owner-scoped (RLS + explicit user_id) and READ-ONLY over the
 * 9.6 `trades` table — analytics never mutate trades and reuse 9.6's derived
 * fields (no recomputation). Soft-deleted AND archived trades are excluded per
 * spec.
 *
 * SCALE NOTE (documented seam): at 1M+ trades this JS-side compute path is
 * replaced by the aggregation plane — the `trade_daily_stats` view / a
 * materialized rollup refreshed by a worker + a hot cache (see
 * IMPORT/ANALYTICS architecture). Reconciliation is identical either way because
 * both read the same `net_pnl`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TradeFilters } from '@/features/journal/filters';
import type { AnalyticsTrade } from '../types';

const ANALYTICS_COLUMNS =
  'id, net_pnl, pnl, rr_ratio, quantity, position_size, risk_amount, risk_percent, direction, symbol, market, asset_type, session, strategy_id, broker_id, trading_account_id, source, opened_at, closed_at, duration_seconds';

/** Safety cap for the JS compute path until the rollup plane is wired. */
const MAX_ROWS = 100_000;

export async function fetchAnalyticsTrades(
  supabase: SupabaseClient,
  userId: string,
  filters: TradeFilters = {},
): Promise<AnalyticsTrade[]> {
  let q = supabase
    .from('trades')
    .select(ANALYTICS_COLUMNS)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .is('archived_at', null);

  if (filters.symbol) q = q.ilike('symbol', `%${filters.symbol}%`);
  if (filters.direction) q = q.eq('direction', filters.direction);
  if (filters.asset_type) q = q.eq('asset_type', filters.asset_type);
  if (filters.session) q = q.eq('session', filters.session);
  if (filters.account_id) q = q.eq('trading_account_id', filters.account_id);
  if (filters.strategy_id) q = q.eq('strategy_id', filters.strategy_id);
  if (filters.broker_id) q = q.eq('broker_id', filters.broker_id);
  if (filters.date_from) q = q.gte('closed_at', filters.date_from);
  if (filters.date_to) q = q.lte('closed_at', filters.date_to);

  const { data } = await q
    .order('closed_at', { ascending: true, nullsFirst: false })
    .limit(MAX_ROWS);

  return (data as AnalyticsTrade[] | null) ?? [];
}
