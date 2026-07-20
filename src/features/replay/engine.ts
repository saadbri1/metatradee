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
 * STEP-BACK BOUNDARY: this candle-only engine moves its cursor directly. The
 * simulation layer observes a backward cursor and REBUILDS orders and fills by
 * re-running its event log from the window start; it never decrements trading
 * state or mutates historical fills. Future position/P&L layers must follow the
 * same rebuild rule rather than extending cursor-decrement semantics.
 */
import type { Candle } from '@/features/chart/types';

export const REPLAY_SPEEDS = ['1x', '2x', '5x', '10x', 'max'] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

export type ReplayStatus = 'idle' | 'ready' | 'playing' | 'paused' | 'completed';

/** A replay needs a past and a future — one candle has nothing to reveal. */
export const MIN_REPLAY_CANDLES = 2;

/**
 * Maximum historical context shown when the chart workspace starts replay.
 * The selector below also reserves at least half of short windows for actual
 * replay, so a small session is never consumed almost entirely by warm-up.
 */
export const REPLAY_CONTEXT_CANDLE_LIMIT = 50;
const MIN_REPLAY_CONTEXT_WINDOW = 20;

export interface ReplayState {
  /** The full, immutable window. NEVER exposed directly to consumers. */
  readonly candles: readonly Candle[];
  /** Index of the latest visible candle; -1 only in `idle`. */
  readonly cursor: number;
  /** Earliest cursor for this replay session; reset/previous never cross it. */
  readonly startCursor: number;
  readonly status: ReplayStatus;
  readonly speed: ReplaySpeed;
}

const EMPTY_CANDLES: readonly Candle[] = Object.freeze([]);

/** The single inactive state. Shared reference — cheap equality checks. */
export const IDLE_REPLAY: ReplayState = Object.freeze({
  candles: EMPTY_CANDLES,
  cursor: -1,
  startCursor: -1,
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
  requestedStartCursor = 0,
): ReplayState {
  if (candles.length < MIN_REPLAY_CANDLES) return IDLE_REPLAY;
  const maximumStart = candles.length - 2;
  const startCursor = Number.isFinite(requestedStartCursor)
    ? Math.min(Math.max(Math.trunc(requestedStartCursor), 0), maximumStart)
    : 0;
  return Object.freeze({
    // Detach from both the caller's array and its mutable candle objects.
    candles: Object.freeze(candles.map((candle) => Object.freeze({ ...candle }))),
    cursor: startCursor,
    startCursor,
    status: 'ready',
    speed,
  });
}

/**
 * Pick a chart-friendly deterministic replay start. Long windows reveal up to
 * 50 context candles; short windows reveal at most half, always retaining at
 * least one hidden future candle. This chooses a cursor only — the caller still
 * initializes the ordinary replay engine, and selectors remain the sole read
 * path for candles.
 */
export function selectReplayStartCursor(candleCount: number): number {
  if (!Number.isFinite(candleCount) || candleCount < MIN_REPLAY_CANDLES) return 0;
  const total = Math.floor(candleCount);
  if (total < MIN_REPLAY_CONTEXT_WINDOW) return 0;
  const contextCandles = Math.min(REPLAY_CONTEXT_CANDLE_LIMIT, Math.floor(total / 2));
  return Math.max(0, Math.min(contextCandles - 1, total - 2));
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
 * tick. Dependent simulation state rebuilds separately; see the module header.
 */
export function stepBackward(state: ReplayState): ReplayState {
  if (state.status === 'idle') return state;
  if (state.cursor <= state.startCursor) {
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
  const clamped = Math.min(Math.max(normalized, state.startCursor), lastIndex(state));
  const status: ReplayStatus = clamped >= lastIndex(state) ? 'completed' : 'paused';
  if (clamped === state.cursor && status === state.status) return state;
  return transition(state, { cursor: clamped, status });
}

/**
 * Jump to the last candle at or before `timeSeconds` (UTC epoch seconds).
 * A timestamp before the session start lands on the selected context cursor —
 * the earliest honest position for this replay — never on an invented one.
 */
export function jumpToTimestamp(state: ReplayState, timeSeconds: number): ReplayState {
  if (state.status === 'idle') return state;
  let target = state.startCursor;
  for (let i = state.startCursor; i < state.candles.length; i++) {
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

/** Back to the selected context cursor, ready to run again — deterministically identical. */
export function reset(state: ReplayState): ReplayState {
  if (state.status === 'idle') return state;
  return transition(state, { cursor: state.startCursor, status: 'ready' });
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
