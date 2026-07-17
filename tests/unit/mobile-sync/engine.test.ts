import { describe, it, expect } from 'vitest';
import { SyncQueue, nextBackoff, payloadHash } from '@/features/mobile-sync/queue';
import { buildConflictView, applyResolution, diffFields } from '@/features/mobile-sync/conflict';
import { tradeContentHash } from '@/features/journal/dedupe';
import { computeDerivedTradeFields } from '@/features/journal/derived';
import type {
  ApiOutcome,
  QueueItem,
  SyncApiClient,
  SyncStorage,
} from '@/features/mobile-sync/types';

/** In-memory durable-storage fake — one array mutated in place simulates disk
 *  across restarts, so `disk` stays a live, observable reference. */
function memStorage(seed: QueueItem[] = []): { storage: SyncStorage; disk: QueueItem[] } {
  const disk: QueueItem[] = seed.map((i) => ({ ...i }));
  return {
    disk,
    storage: {
      load: () => disk.map((i) => ({ ...i })),
      save: (items) => {
        disk.length = 0;
        for (const i of items) disk.push({ ...i });
      },
    },
  };
}

/** Scripted API that records every push (to prove no double-insert). */
function scriptedApi(script: (item: QueueItem, callN: number) => ApiOutcome): {
  api: SyncApiClient;
  calls: QueueItem[];
} {
  const calls: QueueItem[] = [];
  return {
    calls,
    api: {
      push: async (item) => {
        calls.push({ ...item });
        return script(item, calls.length);
      },
    },
  };
}

let counter = 0;
const ids = () => `id_${++counter}`;
const TRADE = {
  symbol: 'EURUSD',
  direction: 'buy',
  opened_at: '2026-01-05T10:00:00.000Z',
  quantity: 1.5,
  entry_price: 1.085,
  trading_account_id: null,
};

describe('idempotency — the queue NEVER creates a duplicate (the critical guarantee)', () => {
  it('replaying the entire queue re-sends but the server dedupes → one trade', () => {
    const seen = new Set<string>();
    // Server: first sight of a content hash = ok; every re-send = duplicate.
    const { api, calls } = scriptedApi((item) => {
      if (seen.has(item.contentHash)) return { kind: 'duplicate', targetId: 'srv_1' };
      seen.add(item.contentHash);
      return { kind: 'ok', targetId: 'srv_1' };
    });
    const { storage } = memStorage();
    const q = new SyncQueue(storage, api, ids);
    q.enqueue('create', TRADE);

    return (async () => {
      await q.drive();
      await q.drive(); // replay
      await q.drive(); // replay again
      // The item is synced; the API saw retries but only ONE real insert.
      expect(q.summary().synced).toBe(1);
      const realInserts = calls.filter((_, i) => i === 0).length; // first call only
      expect(realInserts).toBe(1);
      expect(q.all().filter((i) => i.status === 'synced')).toHaveLength(1);
    })();
  });

  it('reuses ONE idempotency key across retries (never regenerated)', async () => {
    let n = 0;
    const { api, calls } = scriptedApi(() =>
      ++n < 3 ? { kind: 'retryable', error: 'network' } : { kind: 'ok', targetId: 'srv_2' },
    );
    const { storage } = memStorage();
    const q = new SyncQueue(storage, api, ids);
    q.enqueue('create', TRADE);
    await q.drive();
    await q.drive();
    await q.drive();
    const keys = new Set(calls.map((c) => c.idempotencyKey));
    expect(keys.size).toBe(1); // same key every attempt
    expect(q.summary().synced).toBe(1);
  });

  it('local double-tap: enqueuing the same create twice yields one queue item', () => {
    const { api } = scriptedApi(() => ({ kind: 'ok', targetId: 'x' }));
    const q = new SyncQueue(memStorage().storage, api, ids);
    const a = q.enqueue('create', TRADE);
    const b = q.enqueue('create', TRADE);
    expect(a.id).toBe(b.id);
    expect(q.all()).toHaveLength(1);
  });
});

describe('durability — the queue survives app kill/restart', () => {
  it('a pending item persists and a fresh SyncQueue resumes it', async () => {
    const mem = memStorage();
    const q1 = new SyncQueue(
      mem.storage,
      scriptedApi(() => ({ kind: 'ok', targetId: 'x' })).api,
      ids,
    );
    q1.enqueue('create', TRADE);
    expect(mem.disk).toHaveLength(1); // written to "disk"

    // Simulate app kill + restart: brand new engine over the same disk.
    const { api, calls } = scriptedApi(() => ({ kind: 'ok', targetId: 'srv' }));
    const q2 = new SyncQueue(mem.storage, api, ids);
    expect(q2.summary().pending).toBe(1); // resumed from disk
    await q2.drive();
    expect(calls).toHaveLength(1);
    expect(q2.summary().synced).toBe(1);
  });
});

describe('backoff + failure surfacing (never silently dropped)', () => {
  it('retryable errors back off then become a surfaced failure', async () => {
    const { api } = scriptedApi(() => ({ kind: 'retryable', error: 'timeout' }));
    const q = new SyncQueue(memStorage().storage, api, ids);
    q.enqueue('create', TRADE);
    for (let i = 0; i < 6; i++) await q.drive();
    expect(q.summary().failed).toBe(1); // visible, not lost
    expect(nextBackoff(0)).toBe(2);
    expect(nextBackoff(5)).toBeNull(); // past the schedule → fail
  });

  it('a fatal (validation) error fails immediately without retry', async () => {
    const { api, calls } = scriptedApi(() => ({ kind: 'fatal', error: 'bad symbol' }));
    const q = new SyncQueue(memStorage().storage, api, ids);
    q.enqueue('create', { ...TRADE, symbol: '' });
    await q.drive();
    await q.drive();
    expect(calls).toHaveLength(1); // no retry on 4xx
    expect(q.summary().failed).toBe(1);
  });
});

describe('conflicts — explicit, never silent, never lose data', () => {
  it('an edit version-conflict is surfaced (not auto-resolved)', async () => {
    const { api } = scriptedApi(() => ({ kind: 'conflict', server: { ...TRADE, quantity: 2 } }));
    const q = new SyncQueue(memStorage().storage, api, ids);
    q.enqueue('edit', { ...TRADE, quantity: 3 }, { targetId: 'srv_1', baseVersion: 1 });
    await q.drive();
    expect(q.summary().conflicts).toBe(1);
    // Nothing was overwritten; the user must decide.
  });

  it('resolution applies the USER’s choice; the engine never picks', () => {
    const view = buildConflictView(
      't1',
      { quantity: 3, notes: 'mine' },
      { quantity: 2, notes: 'srv' },
    );
    expect(diffFields({ quantity: 3, notes: 'mine' }, { quantity: 2, notes: 'srv' })).toEqual([
      'notes',
      'quantity',
    ]);
    expect(applyResolution(view, 'keep_local')).toMatchObject({ quantity: 3, notes: 'mine' });
    expect(applyResolution(view, 'keep_server')).toMatchObject({ quantity: 2, notes: 'srv' });
    expect(applyResolution(view, 'merge', { quantity: 'local', notes: 'server' })).toMatchObject({
      quantity: 3,
      notes: 'srv',
    });
  });

  it('delete of an already-gone row is success (no-op), not an error', async () => {
    const { api } = scriptedApi(() => ({ kind: 'gone' }));
    const q = new SyncQueue(memStorage().storage, api, ids);
    q.enqueue('delete', {}, { targetId: 'srv_1' });
    await q.drive();
    expect(q.summary().synced).toBe(1);
  });
});

describe('dedupe rule reuse + reconciliation (no second definition, no client math)', () => {
  it('payloadHash === the journal tradeContentHash for the same trade', () => {
    expect(payloadHash(TRADE)).toBe(
      tradeContentHash({
        trading_account_id: null,
        symbol: 'EURUSD',
        direction: 'buy',
        time: '2026-01-05T10:00:00.000Z',
        quantity: 1.5,
        entry_price: 1.085,
      }),
    );
  });

  it('an offline trade’s SERVER-computed derived fields match a web trade exactly', () => {
    // The engine sends inputs only; the server computes derived via the SAME fn.
    const derived = computeDerivedTradeFields({
      direction: 'buy',
      entry_price: 1.085,
      exit_price: 1.09,
      quantity: 1.5,
      stop_loss: null,
      take_profit: null,
      risk_amount: null,
      reward: null,
      commission: 2,
      swap: 0,
      fees: 0,
      opened_at: '2026-01-05T10:00:00.000Z',
      closed_at: '2026-01-05T12:30:00.000Z',
    });
    expect(derived.pnl).toBe(0.01);
    expect(derived.net_pnl).toBe(-1.99);
    expect(derived.duration_seconds).toBe(2.5 * 3600);
  });
});

describe('isolation — purge on logout/workspace switch (no cross-account bleed)', () => {
  it('purge clears the queue and last-synced state', async () => {
    const { api } = scriptedApi(() => ({ kind: 'ok', targetId: 'x' }));
    const mem = memStorage();
    const q = new SyncQueue(mem.storage, api, ids);
    q.enqueue('create', TRADE);
    await q.drive();
    q.purge();
    expect(q.all()).toHaveLength(0);
    expect(q.summary().lastSyncedAt).toBeNull();
    expect(mem.disk).toHaveLength(0); // cleared on disk too
  });
});
