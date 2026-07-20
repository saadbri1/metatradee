/**
 * Replay feature — public surface.
 *
 * `engine.ts` is the pure deterministic domain (safe anywhere, no I/O);
 * `use-replay.ts` is the client controller that paces it. The toolbar lives in
 * `components/` and is imported directly by the chart workspace.
 */
export type { Candle } from '@/features/chart/types';
export {
  IDLE_REPLAY,
  MIN_REPLAY_CANDLES,
  REPLAY_CONTEXT_CANDLE_LIMIT,
  REPLAY_SPEEDS,
  advanceBy,
  complete,
  currentCandle,
  currentTimestamp,
  initializeReplay,
  jumpToIndex,
  jumpToTimestamp,
  pause,
  play,
  progress,
  reset,
  selectReplayStartCursor,
  setSpeed,
  stepBackward,
  stepForward,
  visibleCandles,
  type ReplayProgress,
  type ReplaySpeed,
  type ReplayState,
  type ReplayStatus,
} from './engine';
