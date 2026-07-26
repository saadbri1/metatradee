/**
 * Playbook list filtering, searching, sorting, and pagination — pure and
 * unit-tested, mirroring the Journal's URL-encoded filter contract so the two
 * workspaces behave identically (back/forward safe, shareable links).
 *
 * The playbook set is small and bounded (a user has tens of playbooks, not
 * 100k), so filtering runs in memory over rows the server already returned.
 * Trades are NOT re-read per filter change; metrics are attached once.
 */
import type { StrategyStatus } from './types';
import type { PlaybookMetrics } from './performance';
import { winLossRatio } from './performance';

/** A playbook row joined with its real, trade-derived metrics. */
export interface PlaybookListRow {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  status: StrategyStatus;
  symbols: string[];
  timeframes: string[];
  sessions: string[];
  is_pinned: boolean;
  current_version: number;
  rule_count: number;
  checklist_count: number;
  updated_at: string;
  created_at: string;
  metrics: PlaybookMetrics;
}

export type PlaybookTab = 'active' | 'archived';

export interface PlaybookFilters {
  search?: string;
  symbol?: string;
  direction?: 'buy' | 'sell';
  category?: string;
  /** 'profitable' | 'losing' over real Net P&L. */
  outcome?: 'profitable' | 'losing';
  /** Only playbooks with at least this many linked trades. */
  min_trades?: number;
  reviewed?: 'reviewed' | 'unreviewed';
}

export const PLAYBOOK_SORTS = [
  'updated',
  'name',
  'trades',
  'net_pnl',
  'expectancy',
  'win_rate',
  'profit_factor',
  'avg_win',
  'avg_loss',
  'reviewed',
] as const;
export type PlaybookSortKey = (typeof PLAYBOOK_SORTS)[number];
export type SortDirection = 'asc' | 'desc';

export interface PlaybookSort {
  key: PlaybookSortKey;
  direction: SortDirection;
}

export const DEFAULT_SORT: PlaybookSort = { key: 'updated', direction: 'desc' };
export const DEFAULT_TAB: PlaybookTab = 'active';
export const PAGE_SIZE = 12;

/** Columns whose natural first click should read high→low (money, counts). */
const DESC_FIRST = new Set<PlaybookSortKey>([
  'updated',
  'trades',
  'net_pnl',
  'expectancy',
  'win_rate',
  'profit_factor',
  'avg_win',
  'reviewed',
]);

export function defaultDirectionFor(key: PlaybookSortKey): SortDirection {
  return DESC_FIRST.has(key) ? 'desc' : 'asc';
}

/** Toggle a header: same column flips direction, a new column starts fresh. */
export function nextSort(current: PlaybookSort, key: PlaybookSortKey): PlaybookSort {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: defaultDirectionFor(key) };
}

// ---------------------------------------------------------------------------
// URL state
// ---------------------------------------------------------------------------

export interface PlaybookQuery {
  tab: PlaybookTab;
  filters: PlaybookFilters;
  sort: PlaybookSort;
  page: number;
  view: PlaybookView;
}

export type PlaybookView = 'list' | 'grid';

export function serializePlaybookQuery(query: Partial<PlaybookQuery>): string {
  const params = new URLSearchParams();
  const { tab, filters = {}, sort, page, view } = query;
  if (tab && tab !== DEFAULT_TAB) params.set('tab', tab);
  if (filters.search) params.set('q', filters.search);
  if (filters.symbol) params.set('symbol', filters.symbol);
  if (filters.direction) params.set('direction', filters.direction);
  if (filters.category) params.set('category', filters.category);
  if (filters.outcome) params.set('outcome', filters.outcome);
  if (filters.min_trades !== undefined && filters.min_trades > 0) {
    params.set('min_trades', String(filters.min_trades));
  }
  if (filters.reviewed) params.set('reviewed', filters.reviewed);
  if (sort && (sort.key !== DEFAULT_SORT.key || sort.direction !== DEFAULT_SORT.direction)) {
    params.set('sort', `${sort.key}:${sort.direction}`);
  }
  if (page !== undefined && page > 0) params.set('page', String(page + 1));
  if (view && view !== 'list') params.set('view', view);
  return params.toString();
}

function positiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export function parsePlaybookQuery(params: URLSearchParams): PlaybookQuery {
  const filters: PlaybookFilters = {};
  const search = params.get('q');
  if (search) filters.search = search;
  const symbol = params.get('symbol');
  if (symbol) filters.symbol = symbol;
  const direction = params.get('direction');
  if (direction === 'buy' || direction === 'sell') filters.direction = direction;
  const category = params.get('category');
  if (category) filters.category = category;
  const outcome = params.get('outcome');
  if (outcome === 'profitable' || outcome === 'losing') filters.outcome = outcome;
  const minTrades = positiveInt(params.get('min_trades'));
  if (minTrades !== undefined) filters.min_trades = minTrades;
  const reviewed = params.get('reviewed');
  if (reviewed === 'reviewed' || reviewed === 'unreviewed') filters.reviewed = reviewed;

  const tabParam = params.get('tab');
  const tab: PlaybookTab = tabParam === 'archived' ? 'archived' : DEFAULT_TAB;

  const [sortKey, sortDir] = (params.get('sort') ?? '').split(':');
  const sort: PlaybookSort = (PLAYBOOK_SORTS as readonly string[]).includes(sortKey ?? '')
    ? {
        key: sortKey as PlaybookSortKey,
        direction: sortDir === 'asc' ? 'asc' : sortDir === 'desc' ? 'desc' : 'desc',
      }
    : { ...DEFAULT_SORT };

  const pageParam = positiveInt(params.get('page'));
  const viewParam = params.get('view');

  return {
    tab,
    filters,
    sort,
    page: pageParam ? pageParam - 1 : 0,
    view: viewParam === 'grid' ? 'grid' : 'list',
  };
}

/** How many filters (excluding tab/sort/view) are narrowing the result set. */
export function activeFilterCount(filters: PlaybookFilters): number {
  return Object.values(filters).filter((v) => v !== undefined && v !== '').length;
}

// ---------------------------------------------------------------------------
// Filtering + sorting
// ---------------------------------------------------------------------------

/** Free-text search over name, description, category, symbols, and timeframes. */
function matchesSearch(row: PlaybookListRow, term: string): boolean {
  const haystack = [
    row.name,
    row.description ?? '',
    row.category ?? '',
    ...row.symbols,
    ...row.timeframes,
    ...row.sessions,
  ]
    .join(' ')
    .toLowerCase();
  return term
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

export function filterPlaybooks(
  rows: readonly PlaybookListRow[],
  tab: PlaybookTab,
  filters: PlaybookFilters,
): PlaybookListRow[] {
  return rows.filter((row) => {
    const archived = row.status === 'archived';
    if (tab === 'archived' ? !archived : archived) return false;

    if (filters.search && !matchesSearch(row, filters.search)) return false;
    if (filters.category && row.category !== filters.category) return false;
    if (filters.symbol && !row.metrics.symbols.includes(filters.symbol)) return false;

    if (filters.direction === 'buy' && row.metrics.longNetPnl === null) return false;
    if (filters.direction === 'sell' && row.metrics.shortNetPnl === null) return false;

    const { totalTrades, netProfit } = row.metrics.kpis;
    if (filters.min_trades !== undefined && totalTrades < filters.min_trades) return false;
    // Outcome is only meaningful once real trades exist.
    if (filters.outcome === 'profitable' && !(totalTrades > 0 && netProfit > 0)) return false;
    if (filters.outcome === 'losing' && !(totalTrades > 0 && netProfit < 0)) return false;

    if (filters.reviewed) {
      const rate = row.metrics.reviewedRate;
      if (rate === null) return false; // unknown is never asserted either way
      if (filters.reviewed === 'reviewed' && rate < 1) return false;
      if (filters.reviewed === 'unreviewed' && rate >= 1) return false;
    }
    return true;
  });
}

/** Sort value for a column. Null sorts last in BOTH directions (never as 0). */
function sortValue(row: PlaybookListRow, key: PlaybookSortKey): number | string | null {
  const { kpis, reviewedRate } = row.metrics;
  switch (key) {
    case 'name':
      return row.name.toLowerCase();
    case 'updated':
      return Date.parse(row.updated_at) || 0;
    case 'trades':
      return kpis.totalTrades;
    case 'net_pnl':
      return kpis.totalTrades === 0 ? null : kpis.netProfit;
    case 'expectancy':
      return kpis.expectancy;
    case 'win_rate':
      return kpis.winRate;
    case 'profit_factor':
      return kpis.profitFactor;
    case 'avg_win':
      return kpis.avgWin;
    case 'avg_loss':
      return kpis.avgLoss;
    case 'reviewed':
      return reviewedRate;
  }
}

export function sortPlaybooks(
  rows: readonly PlaybookListRow[],
  sort: PlaybookSort,
): PlaybookListRow[] {
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    // Pinned playbooks lead the default view only; an explicit sort wins.
    if (sort.key === 'updated' && a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;

    const left = sortValue(a, sort.key);
    const right = sortValue(b, sort.key);
    if (left === null && right === null) return a.name.localeCompare(b.name);
    if (left === null) return 1;
    if (right === null) return -1;
    if (typeof left === 'string' || typeof right === 'string') {
      return String(left).localeCompare(String(right)) * factor;
    }
    if (left === right) return a.name.localeCompare(b.name);
    return (left - right) * factor;
  });
}

export interface PlaybookPage {
  rows: PlaybookListRow[];
  page: number;
  pageCount: number;
  total: number;
  first: number;
  last: number;
}

/** Clamp the page into range so a filter change can never strand the user. */
export function paginate(
  rows: readonly PlaybookListRow[],
  page: number,
  pageSize = PAGE_SIZE,
): PlaybookPage {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const start = safePage * pageSize;
  const slice = rows.slice(start, start + pageSize);
  return {
    rows: slice,
    page: safePage,
    pageCount,
    total,
    first: total === 0 ? 0 : start + 1,
    last: start + slice.length,
  };
}

/** The full read pipeline: filter → sort → paginate. */
export function selectPlaybooks(
  rows: readonly PlaybookListRow[],
  query: PlaybookQuery,
  pageSize = PAGE_SIZE,
): PlaybookPage {
  return paginate(
    sortPlaybooks(filterPlaybooks(rows, query.tab, query.filters), query.sort),
    query.page,
    pageSize,
  );
}

export { winLossRatio };
