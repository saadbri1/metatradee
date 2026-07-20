/**
 * Pure replay engine (Phase 2 — replay slice 1).
 *
 * Everything here is deterministic by construction: fixed candles, fixed
 * action scripts, no timers, no randomness. The two properties that matter
 * most — future candles are unreachable, and identical inputs give identical
 * states — are asserted directly.
 */
import { describe, it, expect } from 'vitest';
import {
  IDLE_REPLAY,
  MIN_REPLAY_CANDLES,
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
  type ReplayState,
} from '@/features/replay';
import type { Candle } from '@/features/chart/types';

function bar(i: number): Candle {
  return {
    time: 1_654_548_600 + i * 60,
    open: 4120 + i,
    high: 4122 + i,
    low: 4119 + i,
    close: 4121 + i,
    volume: 100 + i,
  };
}

const FIVE = Array.from({ length: 5 }, (_, i) => bar(i));

describe('initialize', () => {
  it('starts ready at the first candle', () => {
    const s = initializeReplay(FIVE);
    expect(s.status).toBe('ready');
    expect(s.cursor).toBe(0);
    expect(visibleCandles(s)).toEqual([FIVE[0]]);
    expect(s.speed).toBe('1x');
    expect(s.startCursor).toBe(0);
  });

  it('supports a deterministic context cursor while retaining hidden future candles', () => {
    const s = initializeReplay(FIVE, '1x', 2);
    expect(s).toMatchObject({ cursor: 2, startCursor: 2, status: 'ready' });
    expect(visibleCandles(s)).toEqual(FIVE.slice(0, 3));
    expect(s.candles.slice(3)).toHaveLength(2);
  });

  it('selects enough context to keep long chart windows useful', () => {
    expect(selectReplayStartCursor(3)).toBe(0);
    expect(selectReplayStartCursor(20)).toBe(9);
    expect(selectReplayStartCursor(120)).toBe(49);
    expect(selectReplayStartCursor(2)).toBe(0);
  });

  it('refuses an empty dataset with idle, never a throw', () => {
    expect(initializeReplay([])).toBe(IDLE_REPLAY);
  });

  it(`refuses fewer than ${MIN_REPLAY_CANDLES} candles`, () => {
    expect(initializeReplay([bar(0)])).toBe(IDLE_REPLAY);
  });

  it('detaches from the caller array — later caller mutation changes nothing', () => {
    const mine = [...FIVE];
    const s = initializeReplay(mine);
    mine.pop();
    mine.push(bar(99));
    expect(s.candles).toHaveLength(5);
    expect(visibleCandles(s)).toEqual([FIVE[0]]);
  });

  it('defensively copies and freezes candle objects', () => {
    const mine = FIVE.map((candle) => ({ ...candle }));
    const s = initializeReplay(mine);
    mine[0]!.close = -1;
    expect(currentCandle(s)?.close).toBe(FIVE[0]!.close);
    expect(Object.isFrozen(s.candles)).toBe(true);
    expect(Object.isFrozen(currentCandle(s))).toBe(true);
  });
});

describe('future-candle discipline', () => {
  it('visible candles never exceed the cursor through any action sequence', () => {
    let s = initializeReplay(FIVE);
    const actions: Array<(x: ReplayState) => ReplayState> = [
      play,
      stepForward,
      stepForward,
      stepBackward,
      (x) => jumpToIndex(x, 3),
      stepBackward,
      pause,
      stepForward,
      reset,
      stepForward,
    ];
    for (const act of actions) {
      s = act(s);
      const visible = visibleCandles(s);
      expect(visible.length).toBe(s.cursor + 1);
      expect(visible).toEqual(FIVE.slice(0, s.cursor + 1));
    }
  });

  it('selectors return copies — mutating the result cannot leak or corrupt', () => {
    const s = initializeReplay(FIVE);
    const visible = visibleCandles(s);
    visible.push(bar(99));
    expect(visibleCandles(s)).toHaveLength(1);
  });
});

describe('stepping', () => {
  it('steps forward one candle at a time and lands on paused', () => {
    const s = stepForward(initializeReplay(FIVE));
    expect(s.cursor).toBe(1);
    expect(s.status).toBe('paused');
  });

  it('preserves playing across forward steps (the controller tick path)', () => {
    const s = stepForward(play(initializeReplay(FIVE)));
    expect(s.status).toBe('playing');
  });

  it('completes on reaching the final candle', () => {
    const s = advanceBy(play(initializeReplay(FIVE)), 4);
    expect(s.cursor).toBe(4);
    expect(s.status).toBe('completed');
  });

  it('is a no-op past the end — cursor stays bounded', () => {
    const done = advanceBy(initializeReplay(FIVE), 10);
    expect(done.cursor).toBe(4);
    expect(stepForward(done).cursor).toBe(4);
  });

  it('keeps the cursor bounded for non-finite and fractional inputs', () => {
    const s = initializeReplay(FIVE);
    expect(jumpToIndex(s, Number.NaN).cursor).toBe(0);
    expect(jumpToIndex(s, Number.NEGATIVE_INFINITY).cursor).toBe(0);
    expect(jumpToIndex(s, Number.POSITIVE_INFINITY).cursor).toBe(4);
    expect(jumpToIndex(s, 2.9).cursor).toBe(2);
    expect(advanceBy(s, 1.9).cursor).toBe(1);
  });

  it('steps backward to paused and clamps at the first candle', () => {
    let s = advanceBy(initializeReplay(FIVE), 2);
    s = stepBackward(s);
    expect(s.cursor).toBe(1);
    expect(s.status).toBe('paused');
    s = stepBackward(stepBackward(s));
    expect(s.cursor).toBe(0);
    expect(stepBackward(s).cursor).toBe(0);
  });

  it('never steps or jumps behind the selected replay context', () => {
    const start = initializeReplay(FIVE, '1x', 2);
    expect(stepBackward(start).cursor).toBe(2);
    expect(jumpToIndex(start, 0).cursor).toBe(2);
    expect(jumpToTimestamp(start, FIVE[0]!.time).cursor).toBe(2);
  });

  it('stepping back out of completed resumes paused', () => {
    const done = advanceBy(initializeReplay(FIVE), 10);
    const back = stepBackward(done);
    expect(back.status).toBe('paused');
    expect(back.cursor).toBe(3);
  });

  it('handles the minimum two-candle window', () => {
    const two = initializeReplay([bar(0), bar(1)]);
    const s = stepForward(two);
    expect(s.status).toBe('completed');
    expect(visibleCandles(s)).toHaveLength(2);
  });
});

describe('jumps', () => {
  it('jumps by index with clamping and never preserves playing', () => {
    const playing = play(initializeReplay(FIVE));
    expect(jumpToIndex(playing, 2)).toMatchObject({ cursor: 2, status: 'paused' });
    expect(jumpToIndex(playing, -5).cursor).toBe(0);
    expect(jumpToIndex(playing, 50)).toMatchObject({ cursor: 4, status: 'completed' });
  });

  it('jumps to the last candle at or before a timestamp', () => {
    const s = initializeReplay(FIVE);
    expect(jumpToTimestamp(s, FIVE[2]!.time).cursor).toBe(2);
    // Between bars → the earlier bar.
    expect(jumpToTimestamp(s, FIVE[2]!.time + 30).cursor).toBe(2);
    // Before the window → the first candle, never an invented position.
    expect(jumpToTimestamp(s, 0).cursor).toBe(0);
    // After the window → completion.
    expect(jumpToTimestamp(s, FIVE[4]!.time + 999)).toMatchObject({
      cursor: 4,
      status: 'completed',
    });
  });
});

describe('play / pause / reset / complete / speed', () => {
  it('plays only from ready or paused', () => {
    expect(play(initializeReplay(FIVE)).status).toBe('playing');
    expect(play(pause(play(initializeReplay(FIVE)))).status).toBe('playing');
    const done = complete(initializeReplay(FIVE));
    expect(play(done)).toBe(done); // completed cannot play
    expect(play(IDLE_REPLAY)).toBe(IDLE_REPLAY);
  });

  it('pause is a no-op unless playing', () => {
    const ready = initializeReplay(FIVE);
    expect(pause(ready)).toBe(ready);
    expect(pause(play(ready)).status).toBe('paused');
  });

  it('reset returns to the deterministic start', () => {
    const wandered = advanceBy(play(initializeReplay(FIVE)), 3);
    const back = reset(wandered);
    expect(back.cursor).toBe(0);
    expect(back.status).toBe('ready');
    expect(visibleCandles(back)).toEqual([FIVE[0]]);
  });

  it('reset restores a selected context cursor, not an empty-looking first bar', () => {
    const start = initializeReplay(FIVE, '1x', 2);
    const back = reset(advanceBy(start, 2));
    expect(back).toMatchObject({ cursor: 2, startCursor: 2, status: 'ready' });
    expect(visibleCandles(back)).toEqual(FIVE.slice(0, 3));
  });

  it('complete forces the cursor to the final candle', () => {
    expect(complete(initializeReplay(FIVE))).toMatchObject({ cursor: 4, status: 'completed' });
  });

  it('speed changes touch nothing else', () => {
    const s = setSpeed(advanceBy(initializeReplay(FIVE), 2), 'max');
    expect(s.speed).toBe('max');
    expect(s.cursor).toBe(2);
    expect(setSpeed(s, 'max')).toBe(s); // no-op returns same reference
  });
});

describe('determinism and immutability', () => {
  it('the same action script over the same candles is byte-identical', () => {
    const script = (input: readonly Candle[]) => {
      let s = initializeReplay(input);
      s = play(s);
      s = advanceBy(s, 2);
      s = setSpeed(s, '5x');
      s = pause(s);
      s = stepBackward(s);
      s = jumpToTimestamp(s, input[3]!.time);
      s = stepForward(s);
      return s;
    };
    expect(script(FIVE)).toEqual(script(FIVE));
  });

  it('never mutates the input candles or prior states', () => {
    const input = FIVE.map((c) => ({ ...c }));
    const snapshot = structuredClone(input);
    const first = initializeReplay(input);
    const firstSnapshot = { ...first, candles: [...first.candles] };
    advanceBy(play(first), 4);
    stepBackward(first);
    expect(input).toEqual(snapshot);
    expect(first.cursor).toBe(firstSnapshot.cursor);
    expect(first.status).toBe(firstSnapshot.status);
    expect([...first.candles]).toEqual(firstSnapshot.candles);
  });
});

describe('selectors', () => {
  it('reports the current candle and timestamp', () => {
    const s = advanceBy(initializeReplay(FIVE), 2);
    expect(currentCandle(s)).toEqual(FIVE[2]);
    expect(currentTimestamp(s)).toBe(FIVE[2]!.time);
    expect(currentCandle(IDLE_REPLAY)).toBeNull();
    expect(currentTimestamp(IDLE_REPLAY)).toBeNull();
  });

  it('computes 1-based progress with a percent', () => {
    expect(progress(initializeReplay(FIVE))).toEqual({ current: 1, total: 5, percent: 20 });
    expect(progress(advanceBy(initializeReplay(FIVE), 4))).toEqual({
      current: 5,
      total: 5,
      percent: 100,
    });
    expect(progress(IDLE_REPLAY)).toEqual({ current: 0, total: 0, percent: 0 });
  });
});
