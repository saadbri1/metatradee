import { describe, expect, it } from 'vitest';
import { simulationFillMarkers, simulationPriceLines } from '@/features/simulation/annotations';
import type { SimulationState } from '@/features/simulation/types';

const state: SimulationState = {
  currentCursor: 2,
  currentCandleTime: 1_654_548_720,
  nextSequence: 3,
  orders: [
    {
      id: 'limit-1',
      symbol: 'ESM2',
      side: 'buy',
      type: 'limit',
      quantity: 1,
      limitPrice: 4119,
      role: 'entry',
      sequence: 1,
      status: 'working',
      createdCursor: 1,
      createdCandleTime: 1_654_548_660,
      eligibleAfterCursor: 1,
    },
  ],
  fills: [
    {
      sequence: 1,
      orderId: 'market-1',
      side: 'sell',
      quantity: 2,
      price: 4121,
      candleTime: 1_654_548_660,
      cursor: 1,
      role: 'entry',
    },
  ],
};

describe('simulation chart annotations', () => {
  it('combines real working orders with the computed average-entry line', () => {
    expect(
      simulationPriceLines(state, {
        side: 'short',
        quantity: 2,
        averageEntryPrice: 4121,
      }),
    ).toEqual([
      expect.objectContaining({ id: 'limit-1', price: 4119, label: 'Buy limit' }),
      {
        id: 'position:average-entry',
        price: 4121,
        role: 'entry',
        side: 'sell',
        label: 'Average entry · 2 short',
      },
    ]);
  });

  it('never fabricates an average-entry line while flat', () => {
    expect(
      simulationPriceLines(state, { side: 'flat', quantity: 0, averageEntryPrice: null }),
    ).toHaveLength(1);
  });

  it('maps every real fill to a side-specific chart marker', () => {
    expect(simulationFillMarkers(state)).toEqual([
      expect.objectContaining({
        id: 'market-1:fill',
        side: 'sell',
        price: 4121,
        label: 'Sell entry 2 @ 4121',
      }),
    ]);
  });
});
