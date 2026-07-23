/**
 * Trade reads. RLS-scoped (owner-only) — queries also filter by user_id
 * explicitly (defense in depth). List uses KEYSET pagination on
 * (closed_at, id) against the composite index for bounded cost at scale.
 * private_notes is excluded from list projections and only returned by
 * getTrade (owner viewing their own trade).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeKpis } from '@/features/analytics/kpis';
import { decodeCursor, encodeCursor, type TradeFilters, type TradeSort } from '../filters';
import type { JournalSummary, TradeListRow, TradePage, TradeRow, TradeTag } from '../types';

const BASE_COLUMNS =
  'id, user_id, trading_account_id, broker_id, strategy_id, market, symbol, asset_type, direction, entry_price, exit_price, quantity, position_size, stop_loss, take_profit, risk_percent, risk_amount, reward, rr_ratio, commission, swap, fees, pnl, net_pnl, currency, opened_at, closed_at, executed_at, duration_seconds, session, setup, confidence, notes, visibility, status, source, is_favorite, is_pinned, created_at, updated_at';
// `reviewed` is selected when the column exists; listTrades falls back to
// BASE_COLUMNS (reviewed defaulted to false) when the migration is not applied.
const LIST_COLUMNS = `${BASE_COLUMNS}, reviewed`;

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/** Attach each trade's real tags (from tags + trade_tags) to the page rows. */
async function attachTags(
  supabase: SupabaseClient,
  userId: string,
  rows: TradeRow[],
): Promise<TradeListRow[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const { data: links } = await supabase
    .from('trade_tags')
    .select('trade_id, tag_id, tags(id, name, category, color)')
    .eq('user_id', userId)
    .in('trade_id', ids);

  const byTrade = new Map<string, TradeTag[]>();
  for (const link of (links as { trade_id: string; tags: TradeTag | TradeTag[] | null }[] | null) ??
    []) {
    const tag = Array.isArray(link.tags) ? link.tags[0] : link.tags;
    if (!tag) continue;
    const list = byTrade.get(link.trade_id) ?? [];
    list.push(tag);
    byTrade.set(link.trade_id, list);
  }
  return rows.map((row) => ({
    ...row,
    reviewed: row.reviewed ?? false,
    tags: (byTrade.get(row.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

/** Apply every shared Journal filter to a trades query builder. */
function applyTradeFilters<T>(q: T, filters: TradeFilters): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let builder = q as any;
  if (filters.symbol) builder = builder.ilike('symbol', `%${filters.symbol}%`);
  if (filters.search) builder = builder.ilike('symbol', `%${filters.search}%`);
  if (filters.direction) builder = builder.eq('direction', filters.direction);
  if (filters.asset_type) builder = builder.eq('asset_type', filters.asset_type);
  if (filters.session) builder = builder.eq('session', filters.session);
  if (filters.status) builder = builder.eq('status', filters.status);
  if (filters.account_id) builder = builder.eq('trading_account_id', filters.account_id);
  if (filters.strategy_id) builder = builder.eq('strategy_id', filters.strategy_id);
  if (filters.broker_id) builder = builder.eq('broker_id', filters.broker_id);
  if (filters.favorites) builder = builder.eq('is_favorite', true);
  if (filters.reviewed !== undefined) builder = builder.eq('reviewed', filters.reviewed);
  if (filters.date_from) builder = builder.gte('closed_at', filters.date_from);
  if (filters.date_to) builder = builder.lte('closed_at', filters.date_to);
  if (filters.pnl_min !== undefined) builder = builder.gte('net_pnl', filters.pnl_min);
  if (filters.pnl_max !== undefined) builder = builder.lte('net_pnl', filters.pnl_max);
  if (filters.rr_min !== undefined) builder = builder.gte('rr_ratio', filters.rr_min);
  if (filters.rr_max !== undefined) builder = builder.lte('rr_ratio', filters.rr_max);
  return builder as T;
}

/** Resolve trade ids for a tag filter (AND semantics), or null if no filter. */
async function resolveTagFilterIds(
  supabase: SupabaseClient,
  userId: string,
  filters: TradeFilters,
): Promise<string[] | null> {
  if (!filters.tag_ids || filters.tag_ids.length === 0) return null;
  const { data: tagged } = await supabase
    .from('trade_tags')
    .select('trade_id')
    .eq('user_id', userId)
    .in('tag_id', filters.tag_ids);
  const ids = (tagged as { trade_id: string }[] | null)?.map((t) => t.trade_id) ?? [];
  return ids.length > 0 ? ids : [NIL_UUID];
}

interface ListParams {
  filters?: TradeFilters;
  sort?: TradeSort;
  cursor?: string | null;
  limit?: number;
}

function buildListQuery(
  supabase: SupabaseClient,
  userId: string,
  columns: string,
  filters: TradeFilters,
  tagIds: string[] | null,
  sort: TradeSort,
  cursor: string | null,
  limit: number,
) {
  let q = supabase.from('trades').select(columns).eq('user_id', userId).is('deleted_at', null);
  if (tagIds) q = q.in('id', tagIds);
  q = applyTradeFilters(q, filters);

  const ascending = sort === 'oldest';
  const c = decodeCursor(cursor);
  if (c) {
    const op = ascending ? 'gt' : 'lt';
    const ca = c.closed_at ?? 'null';
    q = q.or(`closed_at.${op}.${ca},and(closed_at.eq.${ca},id.${op}.${c.id})`);
  }
  return q
    .order('closed_at', { ascending, nullsFirst: false })
    .order('id', { ascending })
    .limit(limit + 1);
}

export async function listTrades(
  supabase: SupabaseClient,
  userId: string,
  { filters = {}, sort = 'newest', cursor = null, limit = 50 }: ListParams = {},
): Promise<TradePage> {
  const tagIds = await resolveTagFilterIds(supabase, userId, filters);

  // Prefer the reviewed column; if the migration is not applied yet, the select
  // (or a reviewed filter) errors on an unknown column, so retry on the base
  // columns with reviewed omitted. The list keeps working either way.
  let result = await buildListQuery(
    supabase,
    userId,
    LIST_COLUMNS,
    filters,
    tagIds,
    sort,
    cursor,
    limit,
  );
  if (result.error && /reviewed/i.test(result.error.message ?? '')) {
    const { reviewed: _reviewed, ...baseFilters } = filters;
    result = await buildListQuery(
      supabase,
      userId,
      BASE_COLUMNS,
      baseFilters,
      tagIds,
      sort,
      cursor,
      limit,
    );
  }

  const rows = ((result.data as TradeRow[] | null) ?? []).map((r) => ({
    ...r,
    reviewed: r.reviewed ?? false,
  }));
  let nextCursor: string | null = null;
  if (rows.length > limit) {
    const last = rows[limit - 1];
    if (last) nextCursor = encodeCursor({ closed_at: last.closed_at, id: last.id });
    rows.length = limit;
  }
  const items = await attachTags(supabase, userId, rows);
  return { items, nextCursor };
}

/**
 * Aggregate the four Journal KPIs over the FILTERED set. Selects only the
 * columns the KPI math needs (net_pnl, closed_at) — never full rows — and reuses
 * the analytics KPI engine so the formulas live in one place, not the UI.
 */
export async function getTradeSummary(
  supabase: SupabaseClient,
  userId: string,
  filters: TradeFilters = {},
  { limit = 20000 }: { limit?: number } = {},
): Promise<JournalSummary> {
  const tagIds = await resolveTagFilterIds(supabase, userId, filters);
  let q = supabase
    .from('trades')
    .select('net_pnl, closed_at, currency')
    .eq('user_id', userId)
    .is('deleted_at', null);
  if (tagIds) q = q.in('id', tagIds);
  q = applyTradeFilters(q, filters);

  let result = await q.limit(limit);
  if (result.error && /reviewed/i.test(result.error.message ?? '')) {
    const { reviewed: _r, ...base } = filters;
    let retry = supabase
      .from('trades')
      .select('net_pnl, closed_at, currency')
      .eq('user_id', userId)
      .is('deleted_at', null);
    if (tagIds) retry = retry.in('id', tagIds);
    retry = applyTradeFilters(retry, base);
    result = await retry.limit(limit);
  }

  const rows =
    (result.data as
      { net_pnl: number | null; closed_at: string | null; currency: string }[] | null) ?? [];
  const kpis = computeKpis(
    rows.map((r, i) => ({
      id: String(i),
      net_pnl: r.net_pnl,
      pnl: r.net_pnl,
      rr_ratio: null,
      quantity: null,
      position_size: null,
      risk_amount: null,
      risk_percent: null,
      direction: 'buy' as const,
      symbol: '',
      market: null,
      asset_type: null,
      session: null,
      strategy_id: null,
      broker_id: null,
      trading_account_id: null,
      source: 'manual' as const,
      opened_at: null,
      closed_at: r.closed_at,
      duration_seconds: null,
    })),
  );
  const currencies = new Set(rows.map((r) => r.currency).filter(Boolean));
  return {
    totalTrades: kpis.totalTrades,
    decidedTrades: kpis.wins + kpis.losses + kpis.breakEven,
    netProfit: kpis.netProfit,
    profitFactor: kpis.profitFactor,
    winRate: kpis.winRate,
    wins: kpis.wins,
    losses: kpis.losses,
    breakEven: kpis.breakEven,
    avgWin: kpis.avgWin,
    avgLoss: kpis.avgLoss,
    currency: currencies.size === 1 ? [...currencies][0]! : 'USD',
  };
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
