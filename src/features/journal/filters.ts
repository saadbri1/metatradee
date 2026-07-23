/**
 * Trade list filtering, sorting, and KEYSET pagination — pure + unit-tested.
 * Filters compose with AND semantics and are URL-encoded (back/forward safe).
 * Keyset (cursor) pagination is used instead of OFFSET so deep pages stay fast
 * at 100k+ trades: the cursor is (closed_at, id) and the query walks the
 * composite index `(user_id, deleted_at, closed_at desc, id desc)`.
 */
import type { AssetType, Direction, TradeSession, TradeStatus } from './enums';

export interface TradeFilters {
  search?: string;
  symbol?: string;
  direction?: Direction;
  asset_type?: AssetType;
  session?: TradeSession;
  status?: TradeStatus;
  account_id?: string;
  strategy_id?: string;
  broker_id?: string;
  tag_ids?: string[];
  date_from?: string;
  date_to?: string;
  pnl_min?: number;
  pnl_max?: number;
  rr_min?: number;
  rr_max?: number;
  favorites?: boolean;
  reviewed?: boolean;
}

export const TRADE_SORTS = [
  'newest',
  'oldest',
  'profit',
  'loss',
  'duration',
  'rr',
  'alpha',
] as const;
export type TradeSort = (typeof TRADE_SORTS)[number];
export const DEFAULT_SORT: TradeSort = 'newest';

export const TRADE_VIEWS = ['table', 'card', 'compact', 'list'] as const;
export type TradeView = (typeof TRADE_VIEWS)[number];

function num(v: string | null): number | undefined {
  if (v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Serialize filters + sort to a URLSearchParams string (stable, back-safe). */
export function serializeTradeQuery(filters: TradeFilters, sort: TradeSort = DEFAULT_SORT): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== '') p.set(k, v);
  };
  set('q', filters.search);
  set('symbol', filters.symbol);
  set('direction', filters.direction);
  set('asset', filters.asset_type);
  set('session', filters.session);
  set('status', filters.status);
  set('account', filters.account_id);
  set('strategy', filters.strategy_id);
  set('broker', filters.broker_id);
  if (filters.tag_ids && filters.tag_ids.length) p.set('tags', filters.tag_ids.join(','));
  set('from', filters.date_from);
  set('to', filters.date_to);
  set('pnl_min', filters.pnl_min?.toString());
  set('pnl_max', filters.pnl_max?.toString());
  set('rr_min', filters.rr_min?.toString());
  set('rr_max', filters.rr_max?.toString());
  if (filters.favorites) p.set('fav', '1');
  if (filters.reviewed === true) p.set('reviewed', '1');
  if (filters.reviewed === false) p.set('reviewed', '0');
  if (sort !== DEFAULT_SORT) p.set('sort', sort);
  return p.toString();
}

/** Parse a URLSearchParams back into filters + sort (ignores invalid values). */
export function parseTradeQuery(params: URLSearchParams): {
  filters: TradeFilters;
  sort: TradeSort;
} {
  const filters: TradeFilters = {};
  const q = params.get('q');
  if (q) filters.search = q;
  const symbol = params.get('symbol');
  if (symbol) filters.symbol = symbol;
  const direction = params.get('direction');
  if (direction === 'buy' || direction === 'sell') filters.direction = direction;
  const asset = params.get('asset');
  if (asset) filters.asset_type = asset as AssetType;
  const session = params.get('session');
  if (session) filters.session = session as TradeSession;
  const status = params.get('status');
  if (status === 'draft' || status === 'published') filters.status = status;
  const account = params.get('account');
  if (account) filters.account_id = account;
  const strategy = params.get('strategy');
  if (strategy) filters.strategy_id = strategy;
  const broker = params.get('broker');
  if (broker) filters.broker_id = broker;
  const tags = params.get('tags');
  if (tags) filters.tag_ids = tags.split(',').filter(Boolean);
  const from = params.get('from');
  if (from) filters.date_from = from;
  const to = params.get('to');
  if (to) filters.date_to = to;
  filters.pnl_min = num(params.get('pnl_min'));
  filters.pnl_max = num(params.get('pnl_max'));
  filters.rr_min = num(params.get('rr_min'));
  filters.rr_max = num(params.get('rr_max'));
  if (params.get('fav') === '1') filters.favorites = true;
  const reviewed = params.get('reviewed');
  if (reviewed === '1') filters.reviewed = true;
  else if (reviewed === '0') filters.reviewed = false;

  const sortParam = params.get('sort');
  const sort = (TRADE_SORTS as readonly string[]).includes(sortParam ?? '')
    ? (sortParam as TradeSort)
    : DEFAULT_SORT;

  // Drop undefined numeric keys for clean equality in tests/consumers.
  (Object.keys(filters) as (keyof TradeFilters)[]).forEach((k) => {
    if (filters[k] === undefined) delete filters[k];
  });

  return { filters, sort };
}

export interface Cursor {
  closed_at: string | null;
  id: string;
}

/** Encode a keyset cursor to a URL-safe base64 token. */
export function encodeCursor(c: Cursor): string {
  const json = JSON.stringify([c.closed_at, c.id]);
  const b64 =
    typeof btoa === 'function' ? btoa(json) : Buffer.from(json, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode a keyset cursor token; null if missing/invalid. */
export function decodeCursor(token: string | null | undefined): Cursor | null {
  if (!token) return null;
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const json =
      typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf8');
    const parsed = JSON.parse(json) as [string | null, string];
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    return { closed_at: parsed[0], id: parsed[1] };
  } catch {
    return null;
  }
}
