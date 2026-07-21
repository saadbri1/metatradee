/**
 * Pure replay viewport model.
 *
 * This module knows only logical candle indexes. It has no React, chart-vendor,
 * DOM, timer, or market-data dependency. The adapter receives the calculated
 * range and remains responsible only for rendering it.
 */
import type { Candle } from '@/features/chart/types';
import type { ReplayState } from './engine';

export const REPLAY_VIEWPORT_MAX_HISTORY_BARS = 200;
export const REPLAY_VIEWPORT_CURSOR_POSITION = 0.75;

export interface ReplayLogicalRange {
  from: number;
  to: number;
}

export interface ReplayViewportModel {
  readonly startCursor: number;
  readonly historyBars: number;
  readonly startRange: ReplayLogicalRange;
}

export interface ReplayViewportState {
  readonly model: ReplayViewportModel;
  readonly following: boolean;
  /** Cursor whose bounded window remains mounted while the user pans manually. */
  readonly manualCursor: number | null;
  /** Forces the same range to be applied after an explicit resume/reset. */
  readonly revision: number;
}

export interface ReplayChartWindow {
  /** Absolute indexes in the immutable replay session. */
  readonly startIndex: number;
  readonly endIndex: number;
  /** At most 200 revealed candles; never includes a candle after replay.cursor. */
  readonly candles: readonly Candle[];
  /** Absolute replay range; the React bridge translates it for the bounded provider data. */
  readonly logicalRange: ReplayLogicalRange | null;
}

function freezeRange(range: ReplayLogicalRange): ReplayLogicalRange {
  return Object.freeze(range);
}

export function createReplayViewport(startCursor: number): ReplayViewportModel {
  const cursor = Number.isFinite(startCursor) ? Math.max(0, Math.trunc(startCursor)) : 0;
  const historyBars = Math.min(REPLAY_VIEWPORT_MAX_HISTORY_BARS, cursor + 1);
  const historySpan = Math.max(1, historyBars - 1);
  const from = Math.max(0, cursor - historyBars + 1);
  const rightWorkspaceBars =
    (historySpan * (1 - REPLAY_VIEWPORT_CURSOR_POSITION)) / REPLAY_VIEWPORT_CURSOR_POSITION;

  return Object.freeze({
    startCursor: cursor,
    historyBars,
    startRange: freezeRange({ from, to: cursor + rightWorkspaceBars }),
  });
}

export function initializeReplayViewport(startCursor: number): ReplayViewportState {
  return Object.freeze({
    model: createReplayViewport(startCursor),
    following: true,
    manualCursor: null,
    revision: 0,
  });
}

export function replayLogicalRange(
  state: ReplayViewportState,
  cursor: number,
): ReplayLogicalRange | null {
  if (!state.following) return null;
  const boundedCursor = Number.isFinite(cursor)
    ? Math.max(state.model.startCursor, Math.trunc(cursor))
    : state.model.startCursor;
  const shift = boundedCursor - state.model.startCursor;
  return freezeRange({
    from: state.model.startRange.from + shift,
    to: state.model.startRange.to + shift,
  });
}

export function suspendReplayFollow(
  state: ReplayViewportState,
  cursor: number = state.model.startCursor,
): ReplayViewportState {
  if (!state.following) return state;
  const manualCursor = Number.isFinite(cursor)
    ? Math.max(state.model.startCursor, Math.trunc(cursor))
    : state.model.startCursor;
  return Object.freeze({ ...state, following: false, manualCursor });
}

export function resumeReplayFollow(state: ReplayViewportState): ReplayViewportState {
  return Object.freeze({
    ...state,
    following: true,
    manualCursor: null,
    revision: state.revision + 1,
  });
}

export function resetReplayViewport(state: ReplayViewportState): ReplayViewportState {
  return Object.freeze({
    ...state,
    following: true,
    manualCursor: null,
    revision: state.revision + 1,
  });
}

/**
 * Bounded candles and translated range for the chart renderer. The replay
 * engine still owns the complete day/week/month array; only this slice crosses
 * the provider boundary. In manual mode the slice stays anchored so playback
 * cannot pull the user's panned view forward.
 */
export function replayChartWindow(
  replay: ReplayState,
  viewport: ReplayViewportState,
): ReplayChartWindow {
  if (replay.cursor < 0) {
    return Object.freeze({
      startIndex: 0,
      endIndex: -1,
      candles: Object.freeze([]),
      logicalRange: null,
    });
  }
  const requestedEnd = viewport.following
    ? replay.cursor
    : Math.min(replay.cursor, viewport.manualCursor ?? replay.cursor);
  const endIndex = Math.max(0, requestedEnd);
  const startIndex = Math.max(0, endIndex - REPLAY_VIEWPORT_MAX_HISTORY_BARS + 1);
  const candles = Object.freeze(replay.candles.slice(startIndex, endIndex + 1));
  const logicalRange = replayLogicalRange(viewport, replay.cursor);
  return Object.freeze({ startIndex, endIndex, candles, logicalRange });
}

/** Pure exit selector: restore the already-loaded session without fetching. */
export function fullHistoryChartWindow(candles: readonly Candle[]): readonly Candle[] {
  return Object.freeze(candles.slice());
}
