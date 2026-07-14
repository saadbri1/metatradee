import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildTradeRow } from '@/features/journal/server/service';
import type { TradeCreateInput } from '@/features/journal/schemas';

// --- pure service: the write row includes server-computed derived fields -----
describe('buildTradeRow (shared write path)', () => {
  it('embeds derived fields + hash + provenance', () => {
    const input = {
      symbol: 'EURUSD',
      direction: 'buy',
      entry_price: 100,
      exit_price: 110,
      quantity: 5,
      commission: 2,
      swap: 0,
      fees: 0,
      currency: 'USD',
      visibility: 'private',
      status: 'published',
      tag_ids: [],
    } as unknown as TradeCreateInput;

    const row = buildTradeRow(input, 'u1', { source: 'imported', importId: 'imp1' });
    expect(row.pnl).toBe(50);
    expect(row.net_pnl).toBe(48);
    expect(row.source).toBe('imported');
    expect(row.import_id).toBe('imp1');
    expect(typeof row.content_hash).toBe('string');
    expect(row.user_id).toBe('u1');
  });
});

// --- actions (mocked Supabase) ----------------------------------------------
const state = vi.hoisted(() => ({
  single: { data: null as unknown, error: null as unknown },
  insert: { data: { id: 't1' } as unknown, error: null as unknown },
  mutation: { data: [] as unknown, error: null as unknown },
  user: { id: 'u1' } as { id: string } | null,
}));

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(async () => {
    const b: Record<string, unknown> = {};
    const chain = () => b;
    for (const m of [
      'select',
      'insert',
      'update',
      'delete',
      'eq',
      'neq',
      'is',
      'in',
      'ilike',
      'gte',
      'lte',
      'or',
      'order',
    ]) {
      b[m] = vi.fn(chain);
    }
    b.limit = vi.fn(chain);
    b.maybeSingle = vi.fn(async () => state.single);
    b.single = vi.fn(async () => state.insert);
    b.then = (resolve: (v: unknown) => unknown) => resolve(state.mutation);
    return {
      auth: { getUser: vi.fn(async () => ({ data: { user: state.user } })) },
      from: vi.fn(() => b),
      rpc: vi.fn(async () => ({ error: null })),
    };
  }),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('next/headers', () => ({ headers: vi.fn(async () => ({ get: () => null })) }));

import { createTradeAction, bulkDeleteTradesAction } from '@/features/journal/server/actions';

const validTrade = {
  symbol: 'EURUSD',
  direction: 'buy',
  entry_price: 1.1,
  exit_price: 1.12,
  quantity: 1000,
};

beforeEach(() => {
  state.single = { data: null, error: null };
  state.insert = { data: { id: 't1' }, error: null };
  state.mutation = { data: [], error: null };
  state.user = { id: 'u1' };
});

describe('createTradeAction', () => {
  it('creates a trade through the service', async () => {
    const res = await createTradeAction(validTrade);
    expect(res.ok).toBe(true);
    expect(res.id).toBe('t1');
  });

  it('surfaces a full duplicate before saving (no force)', async () => {
    state.single = { data: { id: 'existing' }, error: null };
    const res = await createTradeAction(validTrade);
    expect(res.ok).toBe(false);
    expect(res.duplicateOf).toBe('existing');
  });

  it('saves anyway when forced past a duplicate', async () => {
    state.single = { data: { id: 'existing' }, error: null };
    const res = await createTradeAction(validTrade, { force: true });
    expect(res.ok).toBe(true);
  });

  it('rejects invalid input with field errors', async () => {
    const res = await createTradeAction({ symbol: '', direction: 'nope' });
    expect(res.ok).toBe(false);
    expect(res.fieldErrors).toBeDefined();
  });
});

describe('bulkDeleteTradesAction', () => {
  it('reports the affected count', async () => {
    const ids = ['00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b'];
    state.mutation = { data: [{ id: ids[0] }, { id: ids[1] }], error: null };
    const res = await bulkDeleteTradesAction({ ids });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data?.affected).toBe(2);
  });

  it('rejects an empty selection', async () => {
    const res = await bulkDeleteTradesAction({ ids: [] });
    expect(res.ok).toBe(false);
  });
});
