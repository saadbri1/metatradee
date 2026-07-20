/**
 * Deterministic candle replay engine — PURE domain module.
 *
 * Zero I/O, zero vendor imports, zero wall-clock: no `Date.now()`, no
 * `Math.random()`, no timers. Pacing (how fast `playing` advances in real
 * time) belongs to the controller (`use-replay.ts`), which injects a clock.
 * Given the same candles and the same action sequence, this module produces
 * byte-identical states — the property every replay test leans on.
 *
 * State never mutates: every operation returns a frozen new state (or the SAME
 * reference when the operation is a no-op, which makes React updates cheap).
 * The candle window and each candle are defensively copied and frozen once at
 * `initializeReplay`, so caller mutations cannot corrupt a running replay.
 *
 * FUTURE-CANDLE DISCIPLINE: consumers must read candles ONLY through
 * `visibleCandles` / `currentCandle`. Nothing after the cursor is ever
 * returned by a selector. (The full window does live in client memory — a
 * devtools user can inspect it. Replay is a practice instrument, not a
 * verified competition; see docs/CHART_AND_BACKTESTING_DESIGN.md §3.)
 *
 * STEP-BACK LIMITATION (recorded on purpose): `stepBackward` moves the cursor
 * index directly. That is only sound because NOTHING ELSE depends on replay
 * history yet — no orders, no fills, no positions. The moment simulated
 * orders exist, moving backward must instead REBUILD state by re-running the
 * event log from the window start, because an order filled at candle N cannot
 * be un-filled by decrementing an index. Do not extend cursor-decrement
 * semantics into that world.
 */
import type { Candle } from '@/features/chart/types';

export const REPLAY_SPEEDS = ['1x', '2x', '5x', '10x', 'max'] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

export type ReplayStatus = 'idle' | 'ready' | 'playing' | 'paused' | 'completed';

/** A replay needs a past and a future — one candle has nothing to reveal. */
export const MIN_REPLAY_CANDLES = 2;

export interface ReplayState {
  /** The full, immutable window. NEVER exposed directly to consumers. */
  readonly candles: readonly Candle[];
  /** Index of the latest visible candle; -1 only in `idle`. */
  readonly cursor: number;
  readonly status: ReplayStatus;
  readonly speed: ReplaySpeed;
}

const EMPTY_CANDLES: readonly Candle[] = Object.freeze([]);

/** The single inactive state. Shared reference — cheap equality checks. */
export const IDLE_REPLAY: ReplayState = Object.freeze({
  candles: EMPTY_CANDLES,
  cursor: -1,
  status: 'idle',
  speed: '1x',
});

/**
 * Start a replay over a candle window. Fewer than MIN_REPLAY_CANDLES yields
 * `IDLE_REPLAY` — an explicit "cannot replay this", never a throw, so the UI
 * can render an honest insufficient-data state.
 */
export function initializeReplay(
  candles: readonly Candle[],
  speed: ReplaySpeed = '1x',
): ReplayState {
  if (candles.length < MIN_REPLAY_CANDLES) return IDLE_REPLAY;
  return Object.freeze({
    // Detach from both the caller's array and its mutable candle objects.
    candles: Object.freeze(candles.map((candle) => Object.freeze({ ...candle }))),
    cursor: 0,
    status: 'ready',
    speed,
  });
}

function lastIndex(state: ReplayState): number {
  return state.candles.length - 1;
}

function transition(
  state: ReplayState,
  patch: Partial<Pick<ReplayState, 'cursor' | 'status' | 'speed'>>,
): ReplayState {
  return Object.freeze({ ...state, ...patch });
}

/**
 * Reveal the next candle. The ONLY operation that preserves `playing` (the
 * controller drives playback through it). Reaching the final candle completes
 * the replay; stepping from a non-playing state lands on `paused`.
 */
export function stepForward(state: ReplayState): ReplayState {
  if (state.status === 'idle') return state;
  if (state.cursor >= lastIndex(state)) {
    return state.status === 'completed' ? state : transition(state, { status: 'completed' });
  }
  const cursor = state.cursor + 1;
  const status: ReplayStatus =
    cursor >= lastIndex(state) ? 'completed' : state.status === 'playing' ? 'playing' : 'paused';
  return transition(state, { cursor, status });
}

/**
 * Hide the latest candle again. Always lands on `paused` — moving backward is
 * scrubbing, and scrubbing while "playing" would race the controller's next
 * tick. See the module header for why index-decrement is only valid pre-orders.
 */
export function stepBackward(state: ReplayState): ReplayState {
  if (state.status === 'idle') return state;
  if (state.cursor <= 0) {
    return state.status === 'paused' ? state : transition(state, { status: 'paused' });
  }
  return transition(state, { cursor: state.cursor - 1, status: 'paused' });
}

/** Advance up to `n` candles, preserving `playing` semantics; stops when complete. */
export function advanceBy(state: ReplayState, n: number): ReplayState {
  let next = state;
  const count = Number.isNaN(n) ? 0 : Math.max(0, Math.floor(n));
  for (let i = 0; i < count; i++) {
    const stepped = stepForward(next);
    if (stepped === next) break;
    next = stepped;
  }
  return next;
}

/** Jump to a candle index (clamped). Deliberately never preserves `playing`. */
export function jumpToIndex(state: ReplayState, index: number): ReplayState {
  if (state.status === 'idle') return state;
  const normalized = Number.isFinite(index)
    ? Math.trunc(index)
    : index === Number.POSITIVE_INFINITY
      ? lastIndex(state)
      : 0;
  const clamped = Math.min(Math.max(normalized, 0), lastIndex(state));
  const status: ReplayStatus = clamped >= lastIndex(state) ? 'completed' : 'paused';
  if (clamped === state.cursor && status === state.status) return state;
  return transition(state, { cursor: clamped, status });
}

/**
 * Jump to the last candle at or before `timeSeconds` (UTC epoch seconds).
 * A timestamp before the window lands on the first candle — the earliest
 * honest position — never on an invented one.
 */
export function jumpToTimestamp(state: ReplayState, timeSeconds: number): ReplayState {
  if (state.status === 'idle') return state;
  let target = 0;
  for (let i = 0; i < state.candles.length; i++) {
    if (state.candles[i]!.time <= timeSeconds) target = i;
    else break;
  }
  return jumpToIndex(state, target);
}

/** Begin playback. Only `ready` and `paused` can start; `completed` cannot. */
export function play(state: ReplayState): ReplayState {
  if (state.status !== 'ready' && state.status !== 'paused') return state;
  return transition(state, { status: 'playing' });
}

export function pause(state: ReplayState): ReplayState {
  if (state.status !== 'playing') return state;
  return transition(state, { status: 'paused' });
}

/** Back to the first candle, ready to run again — deterministically identical. */
export function reset(state: ReplayState): ReplayState {
  if (state.status === 'idle') return state;
  return transition(state, { cursor: 0, status: 'ready' });
}

/** Force-complete: cursor to the final candle. */
export function complete(state: ReplayState): ReplayState {
  if (state.status === 'idle') return state;
  return transition(state, { cursor: lastIndex(state), status: 'completed' });
}

export function setSpeed(state: ReplayState, speed: ReplaySpeed): ReplayState {
  if (state.speed === speed) return state;
  return transition(state, { speed });
}

// ---------------------------------------------------------------------------
// Selectors — the ONLY sanctioned reads. None can reach past the cursor.
// ---------------------------------------------------------------------------

/** Candles revealed so far. A fresh array; mutating it cannot affect the state. */
export function visibleCandles(state: ReplayState): Candle[] {
  if (state.cursor < 0) return [];
  return state.candles.slice(0, state.cursor + 1);
}

/** The candle under the cursor, or null when idle. */
export function currentCandle(state: ReplayState): Candle | null {
  return state.candles[state.cursor] ?? null;
}

/** UTC epoch seconds of the current replay position, or null when idle. */
export function currentTimestamp(state: ReplayState): number | null {
  return currentCandle(state)?.time ?? null;
}

export interface ReplayProgress {
  /** 1-based position, e.g. "Candle 12 of 60". Zero when idle. */
  current: number;
  total: number;
  /** 0–100, rounded. */
  percent: number;
}

export function progress(state: ReplayState): ReplayProgress {
  const total = state.candles.length;
  const current = state.cursor + 1;
  return {
    current,
    total,
    percent: total === 0 ? 0 : Math.round((current / total) * 100),
  };
}
