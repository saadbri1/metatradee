'use client';

/**
 * Replay controller — owns the CLOCK, and nothing else.
 *
 * The pure engine (engine.ts) has no concept of real time; this hook paces it.
 * The clock is injected (`ReplayScheduler`) so tests drive playback with a
 * fake scheduler and zero wall-clock waits — the same reason the engine bans
 * `Date.now()`.
 *
 * Timer discipline (the invariants the controller tests assert):
 *   • At most ONE pending timer, ever. The scheduling effect keys on the
 *     whole state, so every transition first cancels (React cleanup), then
 *     schedules at most one successor.
 *   • Pausing, exiting, or unmounting cancels the pending timer via the same
 *     cleanup path — there is no second cancellation mechanism to drift.
 *   • Cleanup also invalidates the callback itself. Even a scheduler that
 *     invokes an already-cancelled callback cannot write stale state.
 *   • Ticks use functional setState and advance only the current playing state.
 *   • Completion needs no special case: `stepForward` lands on `completed`,
 *     the effect sees a non-playing status, and simply schedules nothing.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  IDLE_REPLAY,
  advanceBy,
  initializeReplay,
  jumpToIndex,
  jumpToTimestamp,
  pause,
  play,
  reset,
  setSpeed,
  stepBackward,
  stepForward,
  type Candle,
  type ReplaySpeed,
  type ReplayState,
} from './index';

export interface ReplayScheduler {
  /** Schedule `callback` after `delayMs`; returns a cancel function. */
  schedule(callback: () => void, delayMs: number): () => void;
}

/** Real clock for production use. */
const timeoutScheduler: ReplayScheduler = {
  schedule(callback, delayMs) {
    const id = setTimeout(callback, delayMs);
    return () => clearTimeout(id);
  },
};

/**
 * Bar-reveal pacing per speed. UI pacing constants — deliberately OUTSIDE the
 * pure engine. `max` is one bar per frame-ish tick, fast without freezing the
 * main thread the way a synchronous loop would.
 */
export const SPEED_INTERVAL_MS: Record<ReplaySpeed, number> = {
  '1x': 1000,
  '2x': 500,
  '5x': 200,
  '10x': 100,
  max: 16,
};

export function useReplay(scheduler: ReplayScheduler = timeoutScheduler) {
  const [state, setState] = useState<ReplayState>(IDLE_REPLAY);

  useEffect(() => {
    if (state.status !== 'playing') return;
    let active = true;
    const cancel = scheduler.schedule(() => {
      if (!active) return;
      setState((current) => (current.status === 'playing' ? stepForward(current) : current));
    }, SPEED_INTERVAL_MS[state.speed]);
    return () => {
      active = false;
      cancel();
    };
  }, [state, scheduler]);

  const start = useCallback(
    (candles: readonly Candle[], startCursor = 0) =>
      setState(initializeReplay(candles, '1x', startCursor)),
    [],
  );
  const exit = useCallback(() => setState(IDLE_REPLAY), []);
  const doPlay = useCallback(() => setState((s) => play(s)), []);
  const doPause = useCallback(() => setState((s) => pause(s)), []);
  const togglePlay = useCallback(
    () => setState((s) => (s.status === 'playing' ? pause(s) : play(s))),
    [],
  );
  const next = useCallback(() => setState((s) => stepForward(s)), []);
  const previous = useCallback(() => setState((s) => stepBackward(s)), []);
  const advance = useCallback((n: number) => setState((s) => advanceBy(s, n)), []);
  const doReset = useCallback(() => setState((s) => reset(s)), []);
  const doSetSpeed = useCallback((speed: ReplaySpeed) => setState((s) => setSpeed(s, speed)), []);
  const jumpIndex = useCallback((index: number) => setState((s) => jumpToIndex(s, index)), []);
  const jumpTime = useCallback(
    (timeSeconds: number) => setState((s) => jumpToTimestamp(s, timeSeconds)),
    [],
  );

  return {
    state,
    start,
    exit,
    play: doPlay,
    pause: doPause,
    togglePlay,
    next,
    previous,
    advance,
    reset: doReset,
    setSpeed: doSetSpeed,
    jumpToIndex: jumpIndex,
    jumpToTimestamp: jumpTime,
  };
}

export type ReplayController = ReturnType<typeof useReplay>;
