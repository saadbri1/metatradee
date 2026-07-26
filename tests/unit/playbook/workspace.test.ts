import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  filterPlaybooks,
  nextSort,
  paginate,
  parsePlaybookQuery,
  selectPlaybooks,
  serializePlaybookQuery,
  sortPlaybooks,
  winLossRatio,
  DEFAULT_SORT,
  type PlaybookListRow,
} from '@/features/playbook/filters';
import {
  computeMetrics,
  computeMetricsByPlaybook,
  computeReviewedRate,
  EMPTY_METRICS,
} from '@/features/playbook/performance';
import { nextCopyName, isDuplicateName } from '@/features/playbook/naming';
import {
  readViewPreference,
  saveViewPreference,
  DEFAULT_PLAYBOOK_VIEW,
  PLAYBOOK_VIEW_STORAGE_KEY,
} from '@/features/playbook/view-preference';
import { computeKpis } from '@/features/analytics/kpis';
import type { AnalyticsTrade } from '@/features/analytics/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function trade(overrides: Partial<AnalyticsTrade> = {}): AnalyticsTrade {
  return {
    id: Math.random().toString(36).slice(2),
    net_pnl: 100,
    pnl: 100,
    rr_ratio: 2,
    quantity: 1,
    position_size: 1,
    risk_amount: null,
    risk_percent: null,
    direction: 'buy',
    symbol: 'ES',
    market: null,
    asset_type: 'futures',
    session: null,
    setup: null,
    strategy_id: 'pb-1',
    broker_id: null,
    trading_account_id: null,
    source: 'manual',
    opened_at: '2026-06-01T13:00:00Z',
    closed_at: '2026-06-01T14:00:00Z',
    duration_seconds: 3600,
    ...overrides,
  };
}

function row(overrides: Partial<PlaybookListRow> = {}): PlaybookListRow {
  return {
    id: 'pb-1',
    name: 'Opening drive',
    description: 'Trend continuation off the open',
    category: 'Breakout',
    status: 'active',
    symbols: ['ES'],
    timeframes: ['5m'],
    sessions: [],
    is_pinned: false,
    current_version: 1,
    rule_count: 4,
    checklist_count: 2,
    updated_at: '2026-06-10T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    metrics: EMPTY_METRICS,
    ...overrides,
  };
}

function withTrades(overrides: Partial<PlaybookListRow>, trades: AnalyticsTrade[]) {
  return row({ ...overrides, metrics: computeMetrics(trades) });
}

// ---------------------------------------------------------------------------
// Analytics — derived from real linked trades only
// ---------------------------------------------------------------------------

describe('playbook analytics', () => {
  it('reuses the shared KPI engine rather than recomputing P&L', () => {
    const trades = [trade({ net_pnl: 300 }), trade({ net_pnl: -100 })];
    const metrics = computeMetrics(trades);

    // Identical to the Analytics workspace for the same trade set.
    expect(metrics.kpis).toEqual(computeKpis(trades));
    expect(metrics.kpis.netProfit).toBe(200);
    expect(metrics.kpis.winRate).toBeCloseTo(0.5, 5);
    expect(metrics.kpis.profitFactor).toBeCloseTo(3, 5);
  });

  it('reports an empty playbook as no data, never as zeroes with meaning', () => {
    const metrics = computeMetrics([]);
    expect(metrics.kpis.totalTrades).toBe(0);
    expect(metrics.kpis.winRate).toBeNull();
    expect(metrics.kpis.profitFactor).toBeNull();
    expect(metrics.kpis.expectancy).toBeNull();
    expect(metrics.reviewedRate).toBeNull();
    expect(metrics.longNetPnl).toBeNull();
    expect(metrics.shortNetPnl).toBeNull();
    expect(metrics.lastTradedAt).toBeNull();
  });

  it('splits long and short performance and ranks traded symbols', () => {
    const metrics = computeMetrics([
      trade({ direction: 'buy', net_pnl: 500, symbol: 'ES' }),
      trade({ direction: 'sell', net_pnl: -200, symbol: 'NQ' }),
      trade({ direction: 'buy', net_pnl: 50, symbol: 'ES' }),
    ]);
    expect(metrics.longNetPnl).toBe(550);
    expect(metrics.shortNetPnl).toBe(-200);
    expect(metrics.symbols).toEqual(['ES', 'NQ']); // most-traded first
  });

  it('treats an absent reviewed column as unknown, not as 0% reviewed', () => {
    expect(computeReviewedRate([trade(), trade()])).toBeNull();
    expect(computeReviewedRate([trade({ reviewed: true }), trade({ reviewed: false })])).toBe(0.5);
    // A partially-migrated set only counts trades that actually report the flag.
    expect(computeReviewedRate([trade({ reviewed: true }), trade()])).toBe(1);
  });

  it('groups a mixed trade set by playbook in one pass and ignores unlinked trades', () => {
    const grouped = computeMetricsByPlaybook([
      trade({ strategy_id: 'pb-1', net_pnl: 100 }),
      trade({ strategy_id: 'pb-1', net_pnl: 200 }),
      trade({ strategy_id: 'pb-2', net_pnl: -50 }),
      trade({ strategy_id: null, net_pnl: 9999 }),
    ]);
    expect(grouped.get('pb-1')!.kpis.netProfit).toBe(300);
    expect(grouped.get('pb-2')!.kpis.netProfit).toBe(-50);
    expect(grouped.size).toBe(2); // the unlinked trade belongs to no row
  });

  it('returns a win/loss ratio only when both sides exist', () => {
    expect(winLossRatio(computeKpis([trade({ net_pnl: 200 })]))).toBeNull();
    const both = computeKpis([trade({ net_pnl: 200 }), trade({ net_pnl: -100 })]);
    expect(winLossRatio(both)).toBeCloseTo(2, 5);
  });
});

// ---------------------------------------------------------------------------
// Search + filters
// ---------------------------------------------------------------------------

describe('playbook search and filters', () => {
  const rows = [
    withTrades({ id: 'a', name: 'Opening drive', category: 'Breakout' }, [
      trade({ net_pnl: 500, direction: 'buy', symbol: 'ES', reviewed: true }),
    ]),
    withTrades({ id: 'b', name: 'Mean reversion', category: 'Reversion', symbols: ['NQ'] }, [
      trade({ net_pnl: -300, direction: 'sell', symbol: 'NQ', reviewed: false }),
      trade({ net_pnl: -100, direction: 'sell', symbol: 'NQ', reviewed: false }),
    ]),
    row({ id: 'c', name: 'Archived idea', status: 'archived' }),
  ];

  it('separates active from archived by tab', () => {
    expect(filterPlaybooks(rows, 'active', {}).map((r) => r.id)).toEqual(['a', 'b']);
    expect(filterPlaybooks(rows, 'archived', {}).map((r) => r.id)).toEqual(['c']);
  });

  it('searches name, description, category, symbols, and timeframes', () => {
    expect(filterPlaybooks(rows, 'active', { search: 'opening' }).map((r) => r.id)).toEqual(['a']);
    expect(filterPlaybooks(rows, 'active', { search: 'reversion' }).map((r) => r.id)).toEqual([
      'b',
    ]);
    expect(filterPlaybooks(rows, 'active', { search: 'NQ' }).map((r) => r.id)).toEqual(['b']);
    // All tokens must match, not just one.
    expect(filterPlaybooks(rows, 'active', { search: 'opening reversion' })).toHaveLength(0);
  });

  it('filters on real trade-derived facts', () => {
    expect(filterPlaybooks(rows, 'active', { outcome: 'profitable' }).map((r) => r.id)).toEqual([
      'a',
    ]);
    expect(filterPlaybooks(rows, 'active', { outcome: 'losing' }).map((r) => r.id)).toEqual(['b']);
    expect(filterPlaybooks(rows, 'active', { direction: 'sell' }).map((r) => r.id)).toEqual(['b']);
    expect(filterPlaybooks(rows, 'active', { symbol: 'NQ' }).map((r) => r.id)).toEqual(['b']);
    expect(filterPlaybooks(rows, 'active', { min_trades: 2 }).map((r) => r.id)).toEqual(['b']);
    expect(filterPlaybooks(rows, 'active', { category: 'Breakout' }).map((r) => r.id)).toEqual([
      'a',
    ]);
  });

  it('never asserts a review state it does not know', () => {
    const unknown = withTrades({ id: 'z' }, [trade({ net_pnl: 10 })]); // no reviewed flag
    const set = [...rows, unknown];
    // 'z' is excluded from BOTH reviewed and unreviewed, rather than guessed.
    expect(filterPlaybooks(set, 'active', { reviewed: 'reviewed' }).map((r) => r.id)).toEqual([
      'a',
    ]);
    expect(filterPlaybooks(set, 'active', { reviewed: 'unreviewed' }).map((r) => r.id)).toEqual([
      'b',
    ]);
  });

  it('composes filters with AND semantics', () => {
    expect(filterPlaybooks(rows, 'active', { outcome: 'losing', min_trades: 5 })).toHaveLength(0);
  });

  it('counts only narrowing filters', () => {
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ search: 'x', outcome: 'losing' })).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

describe('playbook sorting', () => {
  const rows = [
    withTrades({ id: 'a', name: 'Alpha' }, [trade({ net_pnl: 100 })]),
    withTrades({ id: 'b', name: 'Bravo' }, [trade({ net_pnl: 900 }), trade({ net_pnl: -100 })]),
    row({ id: 'c', name: 'Charlie' }), // no trades at all
  ];

  it('sorts descending then ascending on repeat clicks of the same column', () => {
    const first = nextSort(DEFAULT_SORT, 'net_pnl');
    expect(first).toEqual({ key: 'net_pnl', direction: 'desc' });
    expect(nextSort(first, 'net_pnl')).toEqual({ key: 'net_pnl', direction: 'asc' });
    // A different column starts fresh rather than inheriting the direction.
    expect(nextSort({ key: 'net_pnl', direction: 'asc' }, 'name')).toEqual({
      key: 'name',
      direction: 'asc',
    });
  });

  it('really reorders rows by the chosen metric', () => {
    const desc = sortPlaybooks(rows, { key: 'net_pnl', direction: 'desc' });
    expect(desc.map((r) => r.id)).toEqual(['b', 'a', 'c']);
    const asc = sortPlaybooks(rows, { key: 'net_pnl', direction: 'asc' });
    expect(asc.slice(0, 2).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('keeps playbooks with no data last in BOTH directions instead of ranking them as zero', () => {
    for (const direction of ['asc', 'desc'] as const) {
      const sorted = sortPlaybooks(rows, { key: 'win_rate', direction });
      expect(sorted[sorted.length - 1]!.id).toBe('c');
    }
  });

  it('leads with pinned playbooks in the default view only', () => {
    const pinned = [
      row({ id: 'x', name: 'X', updated_at: '2020-01-01T00:00:00Z', is_pinned: true }),
      rows[0]!,
    ];
    expect(sortPlaybooks(pinned, DEFAULT_SORT)[0]!.id).toBe('x');
    // An explicit metric sort ignores pinning.
    expect(sortPlaybooks(pinned, { key: 'name', direction: 'asc' })[0]!.name).toBe('Alpha');
  });

  it('does not mutate the input array', () => {
    const input = [...rows];
    sortPlaybooks(input, { key: 'name', direction: 'desc' });
    expect(input.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe('playbook pagination', () => {
  const many = Array.from({ length: 25 }, (_, i) =>
    row({ id: `p${i}`, name: `Playbook ${String(i).padStart(2, '0')}` }),
  );

  it('reports an honest window of the result set', () => {
    const page = paginate(many, 0, 10);
    expect(page.rows).toHaveLength(10);
    expect(page.total).toBe(25);
    expect(page.pageCount).toBe(3);
    expect([page.first, page.last]).toEqual([1, 10]);

    const last = paginate(many, 2, 10);
    expect(last.rows).toHaveLength(5);
    expect([last.first, last.last]).toEqual([21, 25]);
  });

  it('clamps an out-of-range page so a narrowed filter cannot strand the user', () => {
    expect(paginate(many, 99, 10).page).toBe(2);
    expect(paginate(many, -3, 10).page).toBe(0);
    expect(paginate([], 4, 10)).toMatchObject({ page: 0, total: 0, first: 0, last: 0 });
  });

  it('runs filter → sort → paginate as one pipeline', () => {
    const page = selectPlaybooks(
      many,
      {
        tab: 'active',
        // Tokens are ANDed, so this matches only names containing "2" — the
        // 02, 12, and 20..24 rows.
        filters: { search: 'playbook 2' },
        sort: { key: 'name', direction: 'asc' },
        page: 0,
        view: 'list',
      },
      4,
    );
    expect(page.total).toBe(7);
    expect(page.pageCount).toBe(2);
    expect(page.rows.map((r) => r.name)).toEqual([
      'Playbook 02',
      'Playbook 12',
      'Playbook 20',
      'Playbook 21',
    ]);
  });
});

// ---------------------------------------------------------------------------
// URL state
// ---------------------------------------------------------------------------

describe('playbook URL state', () => {
  it('round-trips tab, search, filters, sort, page, and view', () => {
    const query = {
      tab: 'archived' as const,
      filters: {
        search: 'breakout',
        symbol: 'ES',
        direction: 'buy' as const,
        category: 'Breakout',
        outcome: 'profitable' as const,
        min_trades: 5,
        reviewed: 'reviewed' as const,
      },
      sort: { key: 'expectancy' as const, direction: 'asc' as const },
      page: 2,
      view: 'grid' as const,
    };
    const parsed = parsePlaybookQuery(new URLSearchParams(serializePlaybookQuery(query)));
    expect(parsed).toEqual(query);
  });

  it('omits defaults so a clean view produces a clean URL', () => {
    expect(
      serializePlaybookQuery({
        tab: 'active',
        filters: {},
        sort: DEFAULT_SORT,
        page: 0,
        view: 'list',
      }),
    ).toBe('');
  });

  it('ignores invalid values instead of throwing', () => {
    const parsed = parsePlaybookQuery(
      new URLSearchParams('tab=bogus&sort=nonsense&page=-4&view=hologram&min_trades=abc'),
    );
    expect(parsed.tab).toBe('active');
    expect(parsed.sort).toEqual(DEFAULT_SORT);
    expect(parsed.page).toBe(0);
    expect(parsed.view).toBe('list');
    expect(parsed.filters.min_trades).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Duplicate naming
// ---------------------------------------------------------------------------

describe('duplicate naming', () => {
  it('picks a free name rather than colliding with the unique index', () => {
    expect(nextCopyName('Opening drive', [])).toBe('Opening drive (copy)');
    expect(nextCopyName('Opening drive', ['Opening drive (copy)'])).toBe('Opening drive (copy 2)');
    expect(nextCopyName('Opening drive', ['Opening drive (copy)', 'opening drive (copy 2)'])).toBe(
      'Opening drive (copy 3)',
    );
  });

  it('does not nest suffixes when copying a copy', () => {
    expect(nextCopyName('Opening drive (copy)', ['Opening drive (copy)'])).toBe(
      'Opening drive (copy 2)',
    );
  });

  it('respects the 80-character name limit', () => {
    expect(nextCopyName('x'.repeat(90), []).length).toBeLessThanOrEqual(80);
  });

  it('detects duplicate names case-insensitively, ignoring the row being edited', () => {
    expect(isDuplicateName('Opening Drive', ['opening drive'])).toBe(true);
    expect(isDuplicateName('Opening Drive', ['opening drive'], 'Opening Drive')).toBe(false);
    expect(isDuplicateName('   ', ['opening drive'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// List/Grid preference
// ---------------------------------------------------------------------------

describe('list/grid preference', () => {
  function fakeStorage(initial: Record<string, string> = {}) {
    const map = new Map(Object.entries(initial));
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      read: () => Object.fromEntries(map),
    };
  }

  it('persists and restores the chosen view', () => {
    const storage = fakeStorage();
    saveViewPreference('grid', storage);
    expect(storage.read()[PLAYBOOK_VIEW_STORAGE_KEY]).toBe('grid');
    expect(readViewPreference(storage)).toBe('grid');
  });

  it('falls back to the default for missing or corrupt values', () => {
    expect(readViewPreference(fakeStorage())).toBe(DEFAULT_PLAYBOOK_VIEW);
    expect(readViewPreference(fakeStorage({ [PLAYBOOK_VIEW_STORAGE_KEY]: 'carousel' }))).toBe(
      DEFAULT_PLAYBOOK_VIEW,
    );
  });

  it('never breaks the page when storage throws (private browsing)', () => {
    const hostile = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(readViewPreference(hostile)).toBe(DEFAULT_PLAYBOOK_VIEW);
    expect(() => saveViewPreference('grid', hostile)).not.toThrow();
  });
});
