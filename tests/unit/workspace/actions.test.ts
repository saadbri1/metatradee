import { describe, it, expect, vi, beforeEach } from 'vitest';

// Chainable Supabase query-builder mock. Every builder method returns the
// builder; awaiting it yields `mutationResult`; `.maybeSingle()` yields
// `singleResult`. Tests tweak those two before calling an action.
const state = vi.hoisted(() => ({
  singleResult: { data: null as unknown, error: null as unknown },
  mutationResult: { error: null as unknown },
  user: { id: 'u1' } as { id: string } | null,
}));

const { createClientMock } = vi.hoisted(() => {
  return {
    createClientMock: vi.fn(async () => {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      for (const m of ['select', 'update', 'upsert', 'insert', 'delete', 'eq', 'neq', 'is', 'in']) {
        builder[m] = vi.fn(chain);
      }
      builder.maybeSingle = vi.fn(async () => state.singleResult);
      // Thenable so `await builder` resolves the mutation result.
      builder.then = (resolve: (v: unknown) => unknown) => resolve(state.mutationResult);
      return {
        auth: { getUser: vi.fn(async () => ({ data: { user: state.user } })) },
        from: vi.fn(() => builder),
        rpc: vi.fn(async () => ({ error: null })),
        storage: { from: vi.fn(() => ({ remove: vi.fn(async () => ({})) })) },
      };
    }),
  };
});

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('next/headers', () => ({ headers: vi.fn(async () => ({ get: () => null })) }));

import {
  checkUsernameAction,
  updateProfileAction,
  updatePreferencesAction,
  saveTradingProfileAction,
  setOnboardingStepAction,
  completeOnboardingAction,
} from '@/features/workspace/server/actions';

beforeEach(() => {
  state.singleResult = { data: null, error: null };
  state.mutationResult = { error: null };
  state.user = { id: 'u1' };
});

describe('checkUsernameAction', () => {
  it('flags reserved and invalid usernames', async () => {
    expect(await checkUsernameAction({ username: 'admin' })).toEqual({
      available: false,
      reason: 'reserved',
    });
    expect(await checkUsernameAction({ username: '1bad' })).toEqual({
      available: false,
      reason: 'invalid',
    });
  });
  it('reports taken vs available from the DB', async () => {
    state.singleResult = { data: { id: 'other' }, error: null };
    expect(await checkUsernameAction({ username: 'trader_joe' })).toEqual({
      available: false,
      reason: 'taken',
    });
    state.singleResult = { data: null, error: null };
    expect(await checkUsernameAction({ username: 'trader_joe' })).toEqual({
      available: true,
    });
  });
});

describe('updateProfileAction', () => {
  it('rejects invalid input with field errors', async () => {
    const res = await updateProfileAction({ display_name: '', username: 'x' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors).toBeDefined();
  });
  it('saves when the username is available', async () => {
    state.singleResult = { data: null, error: null }; // username free
    const res = await updateProfileAction({
      display_name: 'Joe',
      username: 'trader_joe',
    });
    expect(res.ok).toBe(true);
  });
  it('rejects when the username is taken', async () => {
    state.singleResult = { data: { id: 'other' }, error: null };
    const res = await updateProfileAction({
      display_name: 'Joe',
      username: 'trader_joe',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors?.username).toBeDefined();
  });
});

describe('updatePreferencesAction', () => {
  it('rejects invalid enums', async () => {
    const res = await updatePreferencesAction({ time_format: 'nope' });
    expect(res.ok).toBe(false);
  });
  it('saves valid preferences', async () => {
    const res = await updatePreferencesAction({ theme: 'dark', currency: 'EUR' });
    expect(res.ok).toBe(true);
  });
});

describe('saveTradingProfileAction', () => {
  it('upserts a valid trading profile', async () => {
    const res = await saveTradingProfileAction({
      experience: 'intermediate',
      markets: ['forex'],
    });
    expect(res.ok).toBe(true);
  });
});

describe('onboarding actions', () => {
  it('persists the step and completes', async () => {
    expect(await setOnboardingStepAction({ step: 2 })).toEqual({ ok: true });
    expect(await completeOnboardingAction()).toEqual({ ok: true });
  });
  it('requires a signed-in user to complete', async () => {
    state.user = null;
    const res = await completeOnboardingAction();
    expect(res.ok).toBe(false);
  });
});
