/**
 * Pure replay viewport model.
 *
 * This module knows only logical candle indexes. It has no React, chart-vendor,
 * DOM, timer, or market-data dependency. The adapter receives the calculated
 * range and remains responsible only for rendering it.
 */

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
  /** Forces the same range to be applied after an explicit resume/reset. */
  readonly revision: number;
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

export function suspendReplayFollow(state: ReplayViewportState): ReplayViewportState {
  return state.following ? Object.freeze({ ...state, following: false }) : state;
}

export function resumeReplayFollow(state: ReplayViewportState): ReplayViewportState {
  return Object.freeze({ ...state, following: true, revision: state.revision + 1 });
}

export function resetReplayViewport(state: ReplayViewportState): ReplayViewportState {
  return Object.freeze({ ...state, following: true, revision: state.revision + 1 });
}
