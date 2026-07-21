import { describe, expect, it } from 'vitest';
import {
  REPLAY_VIEWPORT_CURSOR_POSITION,
  createReplayViewport,
  initializeReplayViewport,
  replayLogicalRange,
  resetReplayViewport,
  resumeReplayFollow,
  suspendReplayFollow,
} from '@/features/replay';

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
});
