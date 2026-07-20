import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Candle } from '@/features/chart/types';
import { advanceBy, initializeReplay, reset, stepBackward, stepForward } from '@/features/replay';
import { useSimulation } from '@/features/simulation/use-simulation';

const CANDLES: Candle[] = Array.from({ length: 12 }, (_, index) => ({
  time: 1_700_000_000 + index * 60,
  open: 100 + index,
  high: 101 + index,
  low: 99 + index,
  close: 100.5 + index,
  volume: 10,
}));

describe('client simulation/replay synchronization', () => {
  it('processes a jump through every intermediate candle and rebuilds on backward/reset', async () => {
    const initialReplay = initializeReplay(CANDLES);
    const { result, rerender } = renderHook(({ replay }) => useSimulation(replay, CANDLES), {
      initialProps: { replay: initialReplay },
    });
    await waitFor(() => expect(result.current.state?.currentCursor).toBe(0));
    act(() => {
      result.current.place({
        id: 'limit-1',
        symbol: 'ESZ5',
        side: 'buy',
        type: 'limit',
        quantity: 1,
        limitPrice: 104,
      });
    });

    const jumped = advanceBy(initialReplay, 10);
    rerender({ replay: jumped });
    await waitFor(() => expect(result.current.state?.currentCursor).toBe(10));
    expect(result.current.state?.fills).toEqual([
      expect.objectContaining({ orderId: 'limit-1', cursor: 1 }),
    ]);

    const backward = stepBackward(jumped);
    rerender({ replay: backward });
    await waitFor(() => expect(result.current.state?.currentCursor).toBe(9));
    expect(result.current.state?.fills).toHaveLength(1);

    rerender({ replay: reset(backward) });
    await waitFor(() => expect(result.current.state?.currentCursor).toBe(0));
    expect(result.current.state?.fills).toHaveLength(0);
    expect(result.current.state?.orders[0]?.status).toBe('working');
  });

  it('timer-sized steps and a manual multi-candle action converge exactly', async () => {
    const replay = initializeReplay(CANDLES);
    const timer = renderHook(({ value }) => useSimulation(value, CANDLES), {
      initialProps: { value: replay },
    });
    const manual = renderHook(({ value }) => useSimulation(value, CANDLES), {
      initialProps: { value: replay },
    });
    await waitFor(() => expect(timer.result.current.state).not.toBeNull());
    act(() => {
      timer.result.current.place({
        id: 'market-1',
        symbol: 'ESZ5',
        side: 'buy',
        type: 'market',
        quantity: 1,
      });
      manual.result.current.place({
        id: 'market-1',
        symbol: 'ESZ5',
        side: 'buy',
        type: 'market',
        quantity: 1,
      });
    });
    let stepped = replay;
    for (let index = 0; index < 10; index += 1) {
      stepped = stepForward(stepped);
      timer.rerender({ value: stepped });
    }
    manual.rerender({ value: advanceBy(replay, 10) });
    await waitFor(() => expect(timer.result.current.state?.currentCursor).toBe(10));
    await waitFor(() => expect(manual.result.current.state?.currentCursor).toBe(10));
    expect(timer.result.current.state).toEqual(manual.result.current.state);
  });
});
