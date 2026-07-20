import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Candle } from '@/features/chart/types';
import { digestReplayWindow, type Sha256Hasher } from '@/features/market-data/cache';
import {
  abandonReplay,
  checkpointReplay,
  claimLease,
  completeReplay,
  hydrateReplaySession,
  releaseLease,
  renewLease,
  type MutationContext,
  type ReplayCheckpoint,
  type ReplaySessionResumePayload,
} from '@/features/replay/persistence';

const hasher: Sha256Hasher = {
  sha256Hex: (value) => createHash('sha256').update(value).digest('hex'),
};
const tokenHash = 'a'.repeat(64);
const requestDigest = 'b'.repeat(64);
const candles: Candle[] = [
  { time: 1_735_689_600, open: 100, high: 102, low: 99, close: 101, volume: 10 },
  { time: 1_735_689_660, open: 101, high: 103, low: 100, close: 102, volume: 11 },
  { time: 1_735_689_720, open: 102, high: 104, low: 101, close: 103, volume: 12 },
];

async function payload(): Promise<ReplaySessionResumePayload> {
  const identity = {
    provider: 'provider',
    dataset: 'dataset',
    symbol: 'ES',
    timeframe: '1m' as const,
    sourceSchema: 'ohlcv-1m' as const,
    rangeStart: '2025-01-01T00:00:00Z',
    rangeEnd: '2025-01-01T00:03:00Z',
    normalizationVersion: 1,
    replayEngineVersion: 1,
  };
  return {
    session: {
      sessionId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      ...identity,
      candleDigest: await digestReplayWindow(identity, candles, hasher),
      candleCount: candles.length,
      lifecycleStatus: 'active',
      version: 0,
      retentionExpiresAt: '2025-04-01T00:00:00Z',
      createdAt: '2025-01-02T00:00:00Z',
      updatedAt: '2025-01-02T00:00:00Z',
    },
    checkpoint: {
      cursorIndex: 0,
      cursorTime: candles[0]!.time,
      speed: '2x',
      state: 'ready',
      checkpointedAt: '2025-01-02T00:00:00Z',
    },
    lease: null,
    sourcePins: { revisionIds: ['revision-1'] },
  };
}

function context(version: number, idempotencyKey = 'operation-1'): MutationContext {
  return { expectedVersion: version, idempotencyKey, requestDigest, now: '2025-01-02T00:01:00Z' };
}

describe('replay persistence foundations', () => {
  it('hydrates verified candles at speed and cursor, never playing', async () => {
    const stored = await payload();
    stored.checkpoint = {
      cursorIndex: 1,
      cursorTime: candles[1]!.time,
      speed: '5x',
      state: 'paused',
      checkpointedAt: '2025-01-02T00:00:30Z',
    };
    const state = await hydrateReplaySession(
      stored,
      candles,
      { replayEngineVersion: 1, normalizationVersion: 1 },
      hasher,
    );
    expect(state).toMatchObject({ cursor: 1, speed: '5x', status: 'paused' });
    await expect(
      hydrateReplaySession(
        { ...stored, session: { ...stored.session, candleCount: 4 } },
        candles,
        { replayEngineVersion: 1, normalizationVersion: 1 },
        hasher,
      ),
    ).rejects.toMatchObject({ code: 'COUNT_MISMATCH' });
    await expect(
      hydrateReplaySession(
        stored,
        candles,
        { replayEngineVersion: 2, normalizationVersion: 1 },
        hasher,
      ),
    ).rejects.toMatchObject({ code: 'VERSION_MISMATCH' });
  });

  it('claims, renews, checkpoints, releases, and increments once per success', async () => {
    const initial = await payload();
    const lease = { clientId: 'tab-a', tokenHash, expiresAt: '2025-01-02T00:10:00Z' };
    const claimed = claimLease(initial, context(0), lease);
    expect(claimed).toMatchObject({ ok: true, replayed: false, receipt: { version: 1 } });
    if (!claimed.ok || !claimed.session) throw new Error('claim failed');
    const renewed = renewLease(claimed.session, context(1, 'operation-2'), {
      ...lease,
      expiresAt: '2025-01-02T00:20:00Z',
    });
    expect(renewed).toMatchObject({ ok: true, receipt: { version: 2 } });
    if (!renewed.ok || !renewed.session) throw new Error('renew failed');
    const checkpoint: ReplayCheckpoint = {
      cursorIndex: 1,
      cursorTime: candles[1]!.time,
      speed: '2x',
      state: 'paused',
      checkpointedAt: '2025-01-02T00:01:00Z',
    };
    const saved = checkpointReplay(
      renewed.session,
      context(2, 'operation-3'),
      checkpoint,
      'tab-a',
      tokenHash,
    );
    expect(saved).toMatchObject({
      ok: true,
      receipt: { version: 3, checkpoint: { cursorIndex: 1 } },
    });
    if (!saved.ok || !saved.session) throw new Error('checkpoint failed');
    expect(
      releaseLease(saved.session, context(3, 'operation-4'), 'tab-a', tokenHash),
    ).toMatchObject({ ok: true, receipt: { version: 4, lease: null } });
  });

  it('supports expired takeover, stale rejection, completion, and terminal immutability', async () => {
    const initial = await payload();
    initial.lease = {
      clientId: 'old-tab',
      tokenHash: 'c'.repeat(64),
      expiresAt: '2025-01-01T00:00:00Z',
    };
    const takeover = claimLease(initial, context(0), {
      clientId: 'new-tab',
      tokenHash,
      expiresAt: '2025-01-02T00:10:00Z',
    });
    expect(takeover.ok).toBe(true);
    if (!takeover.ok || !takeover.session) throw new Error('takeover failed');
    expect(abandonReplay(takeover.session, context(0, 'stale-key'))).toEqual({
      ok: false,
      code: 'STALE_VERSION',
    });
    const finalCheckpoint: ReplayCheckpoint = {
      cursorIndex: 2,
      cursorTime: candles[2]!.time,
      speed: 'max',
      state: 'completed',
      checkpointedAt: '2025-01-02T00:01:00Z',
    };
    const completed = completeReplay(
      takeover.session,
      context(1, 'complete'),
      finalCheckpoint,
      'new-tab',
      tokenHash,
    );
    expect(completed).toMatchObject({
      ok: true,
      receipt: { lifecycleStatus: 'completed', version: 2, lease: null },
    });
    if (!completed.ok || !completed.session) throw new Error('completion failed');
    expect(abandonReplay(completed.session, context(2, 'abandon-1'))).toEqual({
      ok: false,
      code: 'TERMINAL_SESSION',
    });
  });

  it('replays matching idempotency and conflicts on a changed digest', async () => {
    const initial = await payload();
    const first = abandonReplay(initial, context(0));
    if (!first.ok) throw new Error('abandon failed');
    expect(
      abandonReplay(initial, { ...context(99), priorIdempotency: first.idempotencyRecord }),
    ).toMatchObject({ ok: true, replayed: true, session: null, receipt: first.receipt });
    expect(
      abandonReplay(initial, {
        ...context(0),
        requestDigest: 'd'.repeat(64),
        priorIdempotency: first.idempotencyRecord,
      }),
    ).toEqual({ ok: false, code: 'IDEMPOTENCY_CONFLICT' });
  });
});
