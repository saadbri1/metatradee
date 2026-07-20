import { describe, expect, it } from 'vitest';
import type { Candle } from '@/features/chart/types';
import {
  initializeSimulationSession,
  moveSimulation,
  recordOrder,
  type SimulationSession,
} from '@/features/simulation';

const CANDLES: Candle[] = Array.from({ length: 12 }, (_, index) => ({
  time: 1_700_000_000 + index * 60,
  open: 100 + index,
  high: 101 + index,
  low: 99 + index,
  close: 100.5 + index,
  volume: 10,
}));

function withMarket(): SimulationSession {
  const result = recordOrder(initializeSimulationSession(CANDLES), {
    id: 'market-1',
    symbol: 'ESZ5',
    side: 'buy',
    type: 'market',
    quantity: 1,
  });
  if (!result.ok) throw result.error;
  return result.value;
}

describe('deterministic replay event log', () => {
  it('processes each forward candle once and fills at the immediate next open', () => {
    const moved = moveSimulation(withMarket(), CANDLES, 1);
    expect(moved.state.currentCursor).toBe(1);
    expect(moved.state.fills).toEqual([
      expect.objectContaining({ orderId: 'market-1', cursor: 1, price: 101 }),
    ]);
  });

  it('a 10-candle advance and jump process every intermediate candle', () => {
    const order = recordOrder(initializeSimulationSession(CANDLES), {
      id: 'limit-1',
      symbol: 'ESZ5',
      side: 'buy',
      type: 'limit',
      quantity: 1,
      limitPrice: 104,
    });
    if (!order.ok) throw order.error;
    const jumped = moveSimulation(order.value, CANDLES, 10);
    expect(jumped.state.currentCursor).toBe(10);
    expect(jumped.state.fills[0]).toMatchObject({ cursor: 1, price: 101 });
  });

  it('backward rebuild exactly reproduces earlier state without duplicate fills', () => {
    const atOne = moveSimulation(withMarket(), CANDLES, 1);
    const atTen = moveSimulation(atOne, CANDLES, 10);
    const rebuilt = moveSimulation(atTen, CANDLES, 1);
    expect(rebuilt.state).toEqual(atOne.state);
    expect(rebuilt.state.fills).toHaveLength(1);
  });

  it('forward after backward remains deterministic and reset rebuilds cursor zero', () => {
    const original = moveSimulation(withMarket(), CANDLES, 10);
    const backward = moveSimulation(original, CANDLES, 2);
    const forwardAgain = moveSimulation(backward, CANDLES, 10);
    expect(forwardAgain.state).toEqual(original.state);
    const reset = moveSimulation(forwardAgain, CANDLES, 0);
    expect(reset.state.currentCursor).toBe(0);
    expect(reset.state.fills).toHaveLength(0);
    expect(reset.state.orders[0]?.status).toBe('working');
  });

  it('timer-sized steps and one manual jump produce byte-equivalent state', () => {
    let timer = withMarket();
    for (let cursor = 1; cursor <= 10; cursor += 1) timer = moveSimulation(timer, CANDLES, cursor);
    const manual = moveSimulation(withMarket(), CANDLES, 10);
    expect(timer).toEqual(manual);
  });
});
