import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Server-action tests over a mocked Supabase client.
 *
 * The focus is the guarantees the UI relies on: authentication, OWNER SCOPING on
 * every read and write, shared-schema validation, and honest failure results.
 */
const state = vi.hoisted(() => ({
  maybeSingle: { data: null as unknown, error: null as unknown },
  single: { data: { id: 'new-id' } as unknown, error: null as unknown },
  list: { data: [] as unknown, error: null as unknown },
  mutation: { error: null as unknown },
  user: { id: 'user-1' } as { id: string } | null,
  /** Every filter applied, so tests can prove owner scoping. */
  calls: [] as { table: string; op: string; args: unknown[] }[],
}));

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(async () => {
    let table = '';
    const builder: Record<string, unknown> = {};
    const record = (op: string) =>
      vi.fn((...args: unknown[]) => {
        state.calls.push({ table, op, args });
        return builder;
      });
    for (const method of [
      'select',
      'insert',
      'update',
      'delete',
      'eq',
      'is',
      'in',
      'order',
      'limit',
      'upsert',
    ]) {
      builder[method] = record(method);
    }
    builder.maybeSingle = vi.fn(async () => state.maybeSingle);
    builder.single = vi.fn(async () => state.single);
    builder.then = (resolve: (v: unknown) => unknown) =>
      resolve({ ...state.list, ...state.mutation });
    return {
      auth: { getUser: vi.fn(async () => ({ data: { user: state.user } })) },
      from: vi.fn((name: string) => {
        table = name;
        return builder;
      }),
    };
  }),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('next/headers', () => ({ headers: vi.fn(async () => ({ get: () => null })) }));
vi.mock('@/features/auth/server/audit', () => ({ logAuditEvent: vi.fn() }));

import {
  createStrategyAction,
  duplicateStrategyAction,
  changeStrategyStatusAction,
  deleteStrategyAction,
  assignTradeToStrategyAction,
  getPlaybookWorkspaceAction,
} from '@/features/playbook/server/actions';

const STRATEGY = {
  id: 'pb-1',
  user_id: 'user-1',
  name: 'Opening drive',
  description: 'Trend continuation',
  category: 'Breakout',
  market: null,
  asset_class: null,
  color: null,
  symbols: ['ES'],
  timeframes: ['5m'],
  sessions: [],
  entry_rules: [{ id: 'r1', text: 'Sweep then displace', required: true }],
  exit_rules: [],
  stop_loss_rules: [],
  take_profit_rules: [],
  position_sizing_rules: [],
  risk_rules: [],
  confirmation_rules: [],
  invalidation_rules: [],
  checklist: [{ id: 'c1', text: 'HTF bias', required: true }],
  notes: null,
  status: 'active',
  current_version: 3,
  is_pinned: false,
  is_archived: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
};

/** Filters applied to a given table, e.g. [['user_id','user-1'], ['id','pb-1']]. */
function filtersFor(table: string): unknown[][] {
  return state.calls.filter((c) => c.table === table && c.op === 'eq').map((c) => c.args);
}

beforeEach(() => {
  state.maybeSingle = { data: null, error: null };
  state.single = { data: { id: 'new-id' }, error: null };
  state.list = { data: [], error: null };
  state.mutation = { error: null };
  state.user = { id: 'user-1' };
  state.calls = [];
  vi.clearAllMocks();
});

describe('authentication', () => {
  it('refuses every mutation when nobody is signed in', async () => {
    state.user = null;
    for (const result of [
      await createStrategyAction({ name: 'X' }),
      await duplicateStrategyAction('pb-1'),
      await changeStrategyStatusAction('pb-1', 'archived'),
      await deleteStrategyAction('pb-1'),
      await assignTradeToStrategyAction('t1', 'pb-1'),
    ]) {
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/signed in/i);
    }
  });

  it('returns an empty workspace rather than another user’s data when signed out', async () => {
    state.user = null;
    await expect(getPlaybookWorkspaceAction()).resolves.toEqual({
      rows: [],
      categories: [],
      symbols: [],
      reviewedAvailable: false,
    });
  });
});

describe('createStrategyAction', () => {
  it('validates against the shared schema before writing', async () => {
    const result = await createStrategyAction({ name: '' });
    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.name).toBeDefined();
    // Nothing reached the database.
    expect(state.calls.some((c) => c.op === 'insert')).toBe(false);
  });

  it('rejects a rule with empty text', async () => {
    const result = await createStrategyAction({
      name: 'Valid name',
      entry_rules: [{ id: 'r1', text: '   ' }],
    });
    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.entry_rules).toBeDefined();
  });

  it('stamps the authenticated owner onto the row', async () => {
    const result = await createStrategyAction({ name: 'Opening drive' });
    expect(result.ok).toBe(true);
    const insert = state.calls.find((c) => c.table === 'strategies' && c.op === 'insert');
    expect(insert!.args[0]).toMatchObject({ user_id: 'user-1', current_version: 1 });
  });

  it('records an initial immutable version snapshot', async () => {
    await createStrategyAction({ name: 'Opening drive' });
    const version = state.calls.find((c) => c.table === 'strategy_versions' && c.op === 'insert');
    expect(version!.args[0]).toMatchObject({ user_id: 'user-1', version: 1 });
  });

  it('reports a database failure honestly instead of a false success', async () => {
    state.single = { data: null, error: { message: 'duplicate key' } };
    const result = await createStrategyAction({ name: 'Opening drive' });
    expect(result.ok).toBe(false);
    expect(result.data).toBeUndefined();
  });
});

describe('duplicateStrategyAction', () => {
  it('refuses to copy a playbook the caller does not own', async () => {
    state.maybeSingle = { data: null, error: null }; // owner-scoped read finds nothing
    const result = await duplicateStrategyAction('someone-elses-id');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('copies rules and checklist under a free name, as a draft, with no trades', async () => {
    state.maybeSingle = { data: STRATEGY, error: null };
    state.list = { data: [{ ...STRATEGY }], error: null };

    const result = await duplicateStrategyAction('pb-1');
    expect(result.ok).toBe(true);

    const insert = state.calls.find((c) => c.table === 'strategies' && c.op === 'insert')!
      .args[0] as Record<string, unknown>;
    expect(insert.name).toBe('Opening drive (copy)');
    expect(insert.entry_rules).toEqual(STRATEGY.entry_rules);
    expect(insert.checklist).toEqual(STRATEGY.checklist);
    // A copy is a draft and starts with no trade history of its own.
    expect(insert.status).toBe('draft');
    expect(insert).not.toHaveProperty('id');
    expect(insert.current_version).toBe(1);
  });
});

describe('changeStrategyStatusAction', () => {
  it('archives and restores through the documented transitions', async () => {
    state.maybeSingle = { data: STRATEGY, error: null };
    await expect(changeStrategyStatusAction('pb-1', 'archived')).resolves.toMatchObject({
      ok: true,
    });

    state.maybeSingle = { data: { ...STRATEGY, status: 'archived' }, error: null };
    await expect(changeStrategyStatusAction('pb-1', 'active')).resolves.toMatchObject({
      ok: true,
    });
  });

  it('scopes the status write to the owner', async () => {
    state.maybeSingle = { data: STRATEGY, error: null };
    await changeStrategyStatusAction('pb-1', 'archived');
    expect(filtersFor('strategies')).toContainEqual(['user_id', 'user-1']);
  });
});

describe('deleteStrategyAction', () => {
  it('soft-deletes and never issues a hard delete', async () => {
    const result = await deleteStrategyAction('pb-1');
    expect(result.ok).toBe(true);

    const update = state.calls.find((c) => c.table === 'strategies' && c.op === 'update');
    expect(update!.args[0]).toHaveProperty('deleted_at');
    expect(state.calls.some((c) => c.op === 'delete')).toBe(false);
    // And it is scoped to the owner.
    expect(filtersFor('strategies')).toContainEqual(['user_id', 'user-1']);
  });

  it('never touches the trades table, so linked trades survive', async () => {
    await deleteStrategyAction('pb-1');
    expect(state.calls.some((c) => c.table === 'trades')).toBe(false);
  });

  it('reports a failure rather than claiming success', async () => {
    state.mutation = { error: { message: 'boom' } };
    await expect(deleteStrategyAction('pb-1')).resolves.toMatchObject({ ok: false });
  });
});

describe('assignTradeToStrategyAction', () => {
  it('verifies ownership of BOTH the playbook and the trade before linking', async () => {
    state.maybeSingle = { data: STRATEGY, error: null };
    const result = await assignTradeToStrategyAction('trade-1', 'pb-1');
    expect(result.ok).toBe(true);

    // The trade lookup and the write are both owner-scoped.
    expect(filtersFor('trades')).toContainEqual(['user_id', 'user-1']);
    const update = state.calls.find((c) => c.table === 'trades' && c.op === 'update');
    expect(update!.args[0]).toEqual({ strategy_id: 'pb-1' });
  });

  it('refuses to link a trade to a playbook the caller does not own', async () => {
    state.maybeSingle = { data: null, error: null };
    const result = await assignTradeToStrategyAction('trade-1', 'someone-elses-playbook');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/playbook not found/i);
    expect(state.calls.some((c) => c.table === 'trades' && c.op === 'update')).toBe(false);
  });

  it('refuses to link a trade the caller does not own', async () => {
    state.maybeSingle = { data: null, error: null };
    const result = await assignTradeToStrategyAction('someone-elses-trade', null);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/trade not found/i);
  });

  it('removes an assignment by writing null, without a playbook lookup', async () => {
    state.maybeSingle = { data: { id: 'trade-1' }, error: null };
    const result = await assignTradeToStrategyAction('trade-1', null);
    expect(result.ok).toBe(true);
    const update = state.calls.find((c) => c.table === 'trades' && c.op === 'update');
    expect(update!.args[0]).toEqual({ strategy_id: null });
  });
});
