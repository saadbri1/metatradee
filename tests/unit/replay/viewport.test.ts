import { describe, expect, it } from 'vitest';
import {
  REPLAY_VIEWPORT_CURSOR_POSITION,
  REPLAY_VIEWPORT_MAX_HISTORY_BARS,
  createReplayViewport,
  fullHistoryChartWindow,
  initializeReplay,
  initializeReplayViewport,
  jumpToIndex,
  replayChartWindow,
  replayLogicalRange,
  resetReplayViewport,
  resumeReplayFollow,
  suspendReplayFollow,
} from '@/features/replay';
import type { Candle } from '@/features/chart/types';

function monthCandles(count = 31 * 24 * 60): Candle[] {
  return Array.from({ length: count }, (_, index) => ({
    time: 1_700_000_000 + index * 60,
    open: 5_000 + index / 100,
    high: 5_001 + index / 100,
    low: 4_999 + index / 100,
    close: 5_000.5 + index / 100,
    volume: 100 + index,
  }));
}

describe('pure replay viewport', () => {
  it('places the starting cursor at the professional follow target', () => {
    const state = initializeReplayViewport(199);
    const range = replayLogicalRange(state, 199)!;
    const position = (199 - range.from) / (range.to - range.from);
    expect(state.model.historyBars).toBe(200);
    expect(position).toBeCloseTo(REPLAY_VIEWPORT_CURSOR_POSITION, 8);
  });

  it('moves exactly one logical bar per revealed candle with stable density', () => {
    const state = initializeReplayViewport(199);
    const start = replayLogicalRange(state, 199)!;
    const next = replayLogicalRange(state, 200)!;
    expect(next.from - start.from).toBe(1);
    expect(next.to - start.to).toBe(1);
    expect(next.to - next.from).toBeCloseTo(start.to - start.from, 8);
  });

  it('never constructs a viewport from a future cursor', () => {
    const model = createReplayViewport(79);
    expect(model.startCursor).toBe(79);
    expect(model.startRange.from).toBe(0);
    expect(model.historyBars).toBe(80);
  });

  it('suspends on manual movement and resumes the current cursor explicitly', () => {
    const following = initializeReplayViewport(149);
    const manual = suspendReplayFollow(following);
    expect(manual.following).toBe(false);
    expect(replayLogicalRange(manual, 160)).toBeNull();

    const resumed = resumeReplayFollow(manual);
    expect(resumed.following).toBe(true);
    expect(resumed.revision).toBe(1);
    expect(replayLogicalRange(resumed, 160)).not.toBeNull();
  });

  it('reset restores follow and the exact starting range', () => {
    const start = initializeReplayViewport(199);
    const reset = resetReplayViewport(suspendReplayFollow(start));
    expect(reset.following).toBe(true);
    expect(replayLogicalRange(reset, 199)).toEqual(start.model.startRange);
  });

  it('keeps a full calendar month in the engine while rendering only 200 revealed bars', () => {
    const candles = monthCandles();
    const replay = jumpToIndex(initializeReplay(candles, '1x', 199), 20_000);
    const window = replayChartWindow(replay, initializeReplayViewport(199));

    expect(replay.candles).toHaveLength(44_640);
    expect(window.candles).toHaveLength(REPLAY_VIEWPORT_MAX_HISTORY_BARS);
    expect(window.startIndex).toBe(19_801);
    expect(window.endIndex).toBe(20_000);
    expect(window.candles.at(-1)?.time).toBe(candles[20_000]!.time);
    expect(window.candles.some((candle) => candle.time > candles[20_000]!.time)).toBe(false);
  });

  it('anchors the bounded data window during manual pan and catches up only on resume', () => {
    const replay = jumpToIndex(initializeReplay(monthCandles(500), '1x', 199), 260);
    const following = initializeReplayViewport(199);
    const manual = suspendReplayFollow(following, replay.cursor);
    const later = jumpToIndex(replay, 300);

    const anchored = replayChartWindow(later, manual);
    expect(anchored.endIndex).toBe(260);
    expect(anchored.logicalRange).toBeNull();

    const resumed = replayChartWindow(later, resumeReplayFollow(manual));
    expect(resumed.endIndex).toBe(300);
    expect(resumed.logicalRange).toEqual(replayLogicalRange(following, 300));
  });

  it('restores the complete already-loaded history without mutating it', () => {
    const candles = monthCandles(400);
    const restored = fullHistoryChartWindow(candles);
    expect(restored).toEqual(candles);
    expect(restored).not.toBe(candles);
    expect(Object.isFrozen(restored)).toBe(true);
  });
});
