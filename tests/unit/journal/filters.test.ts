import { describe, it, expect } from 'vitest';
import {
  serializeTradeQuery,
  parseTradeQuery,
  encodeCursor,
  decodeCursor,
  DEFAULT_SORT,
  type TradeFilters,
} from '@/features/journal/filters';

describe('trade query serialization', () => {
  it('round-trips filters + sort through the URL', () => {
    const filters: TradeFilters = {
      search: 'breakout',
      direction: 'buy',
      asset_type: 'forex',
      account_id: 'acc-1',
      tag_ids: ['t1', 't2'],
      pnl_min: -50,
      pnl_max: 500,
      favorites: true,
    };
    const qs = serializeTradeQuery(filters, 'profit');
    const parsed = parseTradeQuery(new URLSearchParams(qs));
    expect(parsed.filters).toEqual(filters);
    expect(parsed.sort).toBe('profit');
  });

  it('defaults sort and ignores invalid values', () => {
    const parsed = parseTradeQuery(new URLSearchParams('direction=diagonal&sort=chaos'));
    expect(parsed.sort).toBe(DEFAULT_SORT);
    expect(parsed.filters.direction).toBeUndefined();
  });

  it('omits empty filters from the query string', () => {
    expect(serializeTradeQuery({}, DEFAULT_SORT)).toBe('');
  });

  it('round-trips the reviewed filter in both directions', () => {
    for (const reviewed of [true, false]) {
      const qs = serializeTradeQuery({ reviewed }, DEFAULT_SORT);
      expect(parseTradeQuery(new URLSearchParams(qs)).filters.reviewed).toBe(reviewed);
    }
    // Absent when not set.
    expect(parseTradeQuery(new URLSearchParams('')).filters.reviewed).toBeUndefined();
  });
});

describe('keyset cursor', () => {
  it('round-trips a cursor safely', () => {
    const c = { closed_at: '2026-01-01T00:00:00Z', id: 'abc-123' };
    const token = encodeCursor(c);
    expect(token).not.toContain('=');
    expect(decodeCursor(token)).toEqual(c);
  });
  it('handles a null closed_at and rejects garbage', () => {
    const c = { closed_at: null, id: 'z' };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(decodeCursor('not-valid!!')).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });
});
