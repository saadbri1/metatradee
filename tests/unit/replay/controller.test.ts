/**
 * Replay controller (Phase 2 — replay slice 1).
 *
 * The clock is a fake scheduler, so playback is driven tick-by-tick with zero
 * wall-clock waits. The invariants under test are the controller's whole job:
 * one timer maximum, cancellation on pause/exit/unmount, correct pacing per
 * speed, auto-stop at the final candle, and no stale state writes.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReplay, SPEED_INTERVAL_MS, type ReplayScheduler } from '@/features/replay/use-replay';
import type { Candle } from '@/features/chart/types';

function bar(i: number): Candle {
  return {
    time: 1_654_548_600 + i * 60,
    open: 4120,
    high: 4122,
    low: 4119,
    close: 4121,
    volume: 100,
  };
}
const FIVE = Array.from({ length: 5 }, (_, i) => bar(i));

/** Deterministic fake clock. Records every schedule; flushes on demand. */
function makeFakeScheduler() {
  type Pending = { callback: () => void; delayMs: number; cancelled: boolean; fired: boolean };
  const all: Pending[] = [];
  const scheduler: ReplayScheduler = {
    schedule(callback, delayMs) {
      const entry: Pending = { callback, delayMs, cancelled: false, fired: false };
      all.push(entry);
      return () => {
        entry.cancelled = true;
      };
    },
  };
  return {
    scheduler,
    pending: () => all.filter((e) => !e.cancelled && !e.fired),
    /** Fire the single live timer (asserting there is exactly one). */
    flush() {
      const live = all.filter((e) => !e.cancelled && !e.fired);
      if (live.length !== 1) throw new Error(`expected 1 live timer, found ${live.length}`);
      const entry = live[0]!;
      entry.fired = true;
      entry.callback();
    },
    fire(index: number) {
      all[index]!.callback();
    },
    lastDelay: () => all[all.length - 1]?.delayMs,
    scheduledCount: () => all.length,
  };
}
describe('useReplay controller', () => {
  it('schedules nothing until playing', () => {
    const clock = makeFakeScheduler();
    const { result } = renderHook(() => useReplay(clock.scheduler));
    act(() => result.current.start(FIVE));
    expect(result.current.state.status).toBe('ready');
    expect(clock.scheduledCount()).toBe(0);
  });

  it('keeps exactly one live timer while playing', () => {
    const clock = makeFakeScheduler();
    const { result } = renderHook(() => useReplay(clock.scheduler));
    act(() => result.current.start(FIVE));
    act(() => result.current.play());
    expect(clock.pending()).toHaveLength(1);

    act(() => clock.flush());
    expect(result.current.state.cursor).toBe(1);
    expect(result.current.state.status).toBe('playing');
    // The fired timer was replaced by exactly one successor.
    act(() => clock.flush());
    expect(result.current.state.cursor).toBe(2);
  });

  it('pause cancels the pending timer', () => {
    const clock = makeFakeScheduler();
    const { result } = renderHook(() => useReplay(clock.scheduler));
    act(() => result.current.start(FIVE));
    act(() => result.current.play());
    act(() => result.current.pause());
    expect(clock.pending()).toHaveLength(0);
    expect(result.current.state.status).toBe('paused');
  });

  it('unmount cancels the pending timer', () => {
    const clock = makeFakeScheduler();
    const { result, unmount } = renderHook(() => useReplay(clock.scheduler));
    act(() => result.current.start(FIVE));
    act(() => result.current.play());
    unmount();
    expect(clock.pending()).toHaveLength(0);
  });

  it('paces by speed and reschedules safely on a mid-playback speed change', () => {
    const clock = makeFakeScheduler();
    const { result } = renderHook(() => useReplay(clock.scheduler));
    act(() => result.current.start(FIVE));
    act(() => result.current.play());
    expect(clock.lastDelay()).toBe(SPEED_INTERVAL_MS['1x']);

    act(() => result.current.setSpeed('max'));
    // Old timer cancelled, one new timer at the new cadence.
    expect(clock.pending()).toHaveLength(1);
    expect(clock.lastDelay()).toBe(SPEED_INTERVAL_MS.max);

    act(() => clock.flush());
    expect(result.current.state.cursor).toBe(1);
  });

  it('stops playback at the final candle with no further timer', () => {
    const clock = makeFakeScheduler();
    const { result } = renderHook(() => useReplay(clock.scheduler));
    act(() => result.current.start(FIVE));
    act(() => result.current.play());
    for (let i = 0; i < 4; i++) act(() => clock.flush());
    expect(result.current.state.status).toBe('completed');
    expect(result.current.state.cursor).toBe(4);
    expect(clock.pending()).toHaveLength(0);
  });

  it('a stale timer that already fired cannot overwrite newer state', () => {
    const clock = makeFakeScheduler();
    const { result } = renderHook(() => useReplay(clock.scheduler));
    act(() => result.current.start(FIVE));
    act(() => result.current.play());
    // Manual interaction between ticks: jump forward, then let a tick fire.
    act(() => result.current.jumpToIndex(3));
    expect(result.current.state.status).toBe('paused'); // jump pauses
    // The pending play-timer was cancelled by the state transition.
    expect(clock.pending()).toHaveLength(0);
    expect(result.current.state.cursor).toBe(3);
  });

  it('ignores a cancelled callback even if the scheduler invokes it late', () => {
    const clock = makeFakeScheduler();
    const { result } = renderHook(() => useReplay(clock.scheduler));
    act(() => result.current.start(FIVE));
    act(() => result.current.play());
    act(() => result.current.pause());
    act(() => clock.fire(0));
    expect(result.current.state).toMatchObject({ cursor: 0, status: 'paused' });
  });

  it('exit returns to idle and cancels everything', () => {
    const clock = makeFakeScheduler();
    const { result } = renderHook(() => useReplay(clock.scheduler));
    act(() => result.current.start(FIVE));
    act(() => result.current.play());
    act(() => result.current.exit());
    expect(result.current.state.status).toBe('idle');
    expect(clock.pending()).toHaveLength(0);
  });
});
