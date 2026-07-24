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
import { listTradingAccounts } from '@/features/accounts/server/queries';
import type { TradeFilters } from '@/features/journal/filters';
import type { AccountAnalyticsRow, AnalyticsTrade, TagAnalyticsRow } from '../types';

const BASE_COLUMNS =
  'id, net_pnl, pnl, rr_ratio, quantity, position_size, risk_amount, risk_percent, direction, symbol, market, asset_type, session, setup, strategy_id, broker_id, trading_account_id, source, opened_at, closed_at, duration_seconds';
const ANALYTICS_COLUMNS = `${BASE_COLUMNS}, reviewed`;

/** Safety cap for the JS compute path until the rollup plane is wired. */
const MAX_ROWS = 100_000;
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/** Apply the shared analytics filters to a trades query builder. */
function applyFilters<T>(query: T, filters: TradeFilters, tagIds: string[] | null): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = query as any;
  if (tagIds) q = q.in('id', tagIds);
  if (filters.symbol) q = q.ilike('symbol', `%${filters.symbol}%`);
  if (filters.direction) q = q.eq('direction', filters.direction);
  if (filters.asset_type) q = q.eq('asset_type', filters.asset_type);
  if (filters.session) q = q.eq('session', filters.session);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.account_id) q = q.eq('trading_account_id', filters.account_id);
  if (filters.strategy_id) q = q.eq('strategy_id', filters.strategy_id);
  if (filters.broker_id) q = q.eq('broker_id', filters.broker_id);
  if (filters.favorites) q = q.eq('is_favorite', true);
  if (filters.reviewed !== undefined) q = q.eq('reviewed', filters.reviewed);
  if (filters.date_from) q = q.gte('closed_at', filters.date_from);
  if (filters.date_to) q = q.lte('closed_at', filters.date_to);
  return q as T;
}

async function resolveTagIds(
  supabase: SupabaseClient,
  userId: string,
  filters: TradeFilters,
): Promise<string[] | null> {
  if (!filters.tag_ids || filters.tag_ids.length === 0) return null;
  const { data } = await supabase
    .from('trade_tags')
    .select('trade_id')
    .eq('user_id', userId)
    .in('tag_id', filters.tag_ids);
  const ids = (data as { trade_id: string }[] | null)?.map((t) => t.trade_id) ?? [];
  return ids.length > 0 ? ids : [NIL_UUID];
}

export async function fetchAnalyticsTrades(
  supabase: SupabaseClient,
  userId: string,
  filters: TradeFilters = {},
): Promise<AnalyticsTrade[]> {
  const tagIds = await resolveTagIds(supabase, userId, filters);
  const run = (columns: string, f: TradeFilters) =>
    applyFilters(
      supabase
        .from('trades')
        .select(columns)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .is('archived_at', null),
      f,
      tagIds,
    )
      .order('closed_at', { ascending: true, nullsFirst: false })
      .limit(MAX_ROWS);

  // Prefer the reviewed column; fall back if the migration is not applied yet.
  let result = await run(ANALYTICS_COLUMNS, filters);
  if (result.error && /reviewed/i.test(result.error.message ?? '')) {
    const { reviewed: _r, ...base } = filters;
    result = await run(BASE_COLUMNS, base);
  }
  return ((result.data as AnalyticsTrade[] | null) ?? []).map((t) => ({
    ...t,
    setup: t.setup ?? null,
  }));
}

/**
 * Aggregate the filtered trades by tag (real tags + trade_tags). Net P&L and
 * count per tag; category distinguishes mistake tags. Association only — never a
 * causal claim.
 */
export async function fetchAnalyticsTagRows(
  supabase: SupabaseClient,
  userId: string,
  trades: AnalyticsTrade[],
): Promise<TagAnalyticsRow[]> {
  if (trades.length === 0) return [];
  const pnlById = new Map(trades.map((t) => [t.id, t.net_pnl]));
  const ids = trades.map((t) => t.id);
  type TagShape = { id: string; name: string; category: string; color: string | null };
  type Link = { trade_id: string; tags: TagShape | TagShape[] | null };
  // Batch to keep the `in` list bounded.
  const links: Link[] = [];
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await supabase
      .from('trade_tags')
      .select('trade_id, tags(id, name, category, color)')
      .eq('user_id', userId)
      .in('trade_id', ids.slice(i, i + 500));
    if (data) links.push(...(data as unknown as Link[]));
  }

  const byTag = new Map<
    string,
    { name: string; category: string; count: number; net: number; decided: number }
  >();
  for (const link of links) {
    const tag = Array.isArray(link.tags) ? link.tags[0] : link.tags;
    if (!tag) continue;
    const entry = byTag.get(tag.id) ?? {
      name: tag.name,
      category: tag.category,
      count: 0,
      net: 0,
      decided: 0,
    };
    entry.count += 1;
    const pnl = pnlById.get(link.trade_id) ?? null;
    if (pnl !== null) {
      entry.net += pnl;
      entry.decided += 1;
    }
    byTag.set(tag.id, entry);
  }

  return [...byTag.entries()]
    .map(([id, e]) => ({
      id,
      name: e.name,
      category: e.category as TagAnalyticsRow['category'],
      count: e.count,
      netPnl: Math.round(e.net * 100) / 100,
      avgPnl: e.decided > 0 ? Math.round((e.net / e.decided) * 100) / 100 : null,
    }))
    .sort((a, b) => a.netPnl - b.netPnl);
}

/** Real account metadata for the per-account analytics (no invented balances). */
export async function fetchAnalyticsAccounts(
  supabase: SupabaseClient,
  userId: string,
): Promise<Pick<AccountAnalyticsRow, 'id' | 'name' | 'type' | 'provider'>[]> {
  const accounts = await listTradingAccounts(supabase, userId);
  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.account_type,
    provider: a.provider ?? null,
  }));
}
