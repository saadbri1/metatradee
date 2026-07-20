import type { Candle } from '@/features/chart/types';
import { digestReplayWindow, type Sha256Hasher } from '@/features/market-data/cache/canonical';
import { initializeReplay, jumpToIndex, type ReplayState } from '../engine';
import { replaySessionResumePayloadSchema, type ReplaySessionResumePayload } from './schemas';

export type ReplayHydrationErrorCode =
  | 'INVALID_PAYLOAD'
  | 'VERSION_MISMATCH'
  | 'COUNT_MISMATCH'
  | 'DIGEST_MISMATCH'
  | 'CURSOR_MISMATCH'
  | 'TERMINAL_INCONSISTENCY';

export class ReplayHydrationError extends Error {
  constructor(
    readonly code: ReplayHydrationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ReplayHydrationError';
  }
}

export interface HydrationVersions {
  replayEngineVersion: number;
  normalizationVersion: number;
}

export async function hydrateReplaySession(
  input: ReplaySessionResumePayload,
  candles: readonly Candle[],
  versions: HydrationVersions,
  hasher: Sha256Hasher,
): Promise<ReplayState> {
  const parsed = replaySessionResumePayloadSchema.safeParse(input);
  if (!parsed.success) throw new ReplayHydrationError('INVALID_PAYLOAD', parsed.error.message);
  const { session, checkpoint } = parsed.data;
  if (
    session.replayEngineVersion !== versions.replayEngineVersion ||
    session.normalizationVersion !== versions.normalizationVersion
  ) {
    throw new ReplayHydrationError('VERSION_MISMATCH', 'Replay or normalization version differs.');
  }
  if (session.candleCount !== candles.length) {
    throw new ReplayHydrationError('COUNT_MISMATCH', 'Persisted candle count differs.');
  }
  if (
    checkpoint.cursorIndex >= candles.length ||
    candles[checkpoint.cursorIndex]?.time !== checkpoint.cursorTime
  ) {
    throw new ReplayHydrationError(
      'CURSOR_MISMATCH',
      'Checkpoint cursor does not match its candle.',
    );
  }
  const finalCursor = candles.length - 1;
  const validTerminal =
    session.lifecycleStatus === 'active'
      ? checkpoint.state !== 'completed' && checkpoint.cursorIndex < finalCursor
      : session.lifecycleStatus === 'completed'
        ? checkpoint.state === 'completed' && checkpoint.cursorIndex === finalCursor
        : false;
  if (!validTerminal || (checkpoint.state === 'ready' && checkpoint.cursorIndex !== 0)) {
    throw new ReplayHydrationError(
      'TERMINAL_INCONSISTENCY',
      'Lifecycle and checkpoint state conflict.',
    );
  }
  const actualDigest = await digestReplayWindow(
    {
      provider: session.provider,
      dataset: session.dataset,
      symbol: session.symbol,
      timeframe: session.timeframe,
      sourceSchema: session.sourceSchema,
      rangeStart: session.rangeStart,
      rangeEnd: session.rangeEnd,
      normalizationVersion: session.normalizationVersion,
      replayEngineVersion: session.replayEngineVersion,
    },
    candles,
    hasher,
  );
  if (actualDigest !== session.candleDigest) {
    throw new ReplayHydrationError('DIGEST_MISMATCH', 'Persisted candle digest differs.');
  }
  const initialized = initializeReplay(candles, checkpoint.speed);
  if (checkpoint.state === 'ready') return initialized;
  return jumpToIndex(initialized, checkpoint.cursorIndex);
}
