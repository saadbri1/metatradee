/**
 * Trade reads. RLS-scoped (owner-only) — queries also filter by user_id
 * explicitly (defense in depth). List uses KEYSET pagination on
 * (closed_at, id) against the composite index for bounded cost at scale.
 * private_notes is excluded from list projections and only returned by
 * getTrade (owner viewing their own trade).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { decodeCursor, encodeCursor, type TradeFilters, type TradeSort } from '../filters';
import type { TradePage, TradeRow } from '../types';

const LIST_COLUMNS =
  'id, user_id, trading_account_id, broker_id, strategy_id, market, symbol, asset_type, direction, entry_price, exit_price, quantity, position_size, stop_loss, take_profit, risk_percent, risk_amount, reward, rr_ratio, commission, swap, fees, pnl, net_pnl, currency, opened_at, closed_at, executed_at, duration_seconds, session, setup, confidence, notes, visibility, status, source, is_favorite, is_pinned, created_at, updated_at';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

interface ListParams {
  filters?: TradeFilters;
  sort?: TradeSort;
  cursor?: string | null;
  limit?: number;
}

export async function listTrades(
  supabase: SupabaseClient,
  userId: string,
  { filters = {}, sort = 'newest', cursor = null, limit = 50 }: ListParams = {},
): Promise<TradePage> {
  let q = supabase.from('trades').select(LIST_COLUMNS).eq('user_id', userId).is('deleted_at', null);

  // Tag filter → resolve trade ids from the join table first (AND semantics).
  if (filters.tag_ids && filters.tag_ids.length > 0) {
    const { data: tagged } = await supabase
      .from('trade_tags')
      .select('trade_id')
      .eq('user_id', userId)
      .in('tag_id', filters.tag_ids);
    const ids = (tagged as { trade_id: string }[] | null)?.map((t) => t.trade_id) ?? [];
    q = q.in('id', ids.length > 0 ? ids : [NIL_UUID]);
  }

  if (filters.symbol) q = q.ilike('symbol', `%${filters.symbol}%`);
  if (filters.search) q = q.ilike('symbol', `%${filters.search}%`);
  if (filters.direction) q = q.eq('direction', filters.direction);
  if (filters.asset_type) q = q.eq('asset_type', filters.asset_type);
  if (filters.session) q = q.eq('session', filters.session);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.account_id) q = q.eq('trading_account_id', filters.account_id);
  if (filters.strategy_id) q = q.eq('strategy_id', filters.strategy_id);
  if (filters.broker_id) q = q.eq('broker_id', filters.broker_id);
  if (filters.favorites) q = q.eq('is_favorite', true);
  if (filters.date_from) q = q.gte('closed_at', filters.date_from);
  if (filters.date_to) q = q.lte('closed_at', filters.date_to);
  if (filters.pnl_min !== undefined) q = q.gte('net_pnl', filters.pnl_min);
  if (filters.pnl_max !== undefined) q = q.lte('net_pnl', filters.pnl_max);
  if (filters.rr_min !== undefined) q = q.gte('rr_ratio', filters.rr_min);
  if (filters.rr_max !== undefined) q = q.lte('rr_ratio', filters.rr_max);

  const ascending = sort === 'oldest';
  const c = decodeCursor(cursor);
  if (c) {
    const op = ascending ? 'gt' : 'lt';
    const ca = c.closed_at ?? 'null';
    q = q.or(`closed_at.${op}.${ca},and(closed_at.eq.${ca},id.${op}.${c.id})`);
  }

  const { data } = await q
    .order('closed_at', { ascending, nullsFirst: false })
    .order('id', { ascending })
    .limit(limit + 1);

  const rows = (data as TradeRow[] | null) ?? [];
  let nextCursor: string | null = null;
  if (rows.length > limit) {
    const last = rows[limit - 1];
    if (last) nextCursor = encodeCursor({ closed_at: last.closed_at, id: last.id });
    rows.length = limit;
  }
  return { items: rows, nextCursor };
}

export async function getTrade(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<(TradeRow & { private_notes: string | null; tag_ids: string[] }) | null> {
  const { data } = await supabase
    .from('trades')
    .select(`${LIST_COLUMNS}, private_notes`)
    .eq('user_id', userId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return null;

  const { data: tags } = await supabase
    .from('trade_tags')
    .select('tag_id')
    .eq('user_id', userId)
    .eq('trade_id', id);

  return {
    ...(data as TradeRow & { private_notes: string | null }),
    tag_ids: (tags as { tag_id: string }[] | null)?.map((t) => t.tag_id) ?? [],
  };
}
