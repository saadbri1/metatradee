import { describe, expect, it } from 'vitest';
import { simulationFillMarkers, simulationPriceLines } from '@/features/simulation/annotations';
import { INSTRUMENT_SPECIFICATIONS } from '@/features/simulation/instruments';
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
    expect(simulationFillMarkers(state, INSTRUMENT_SPECIFICATIONS.ES)).toEqual([
      expect.objectContaining({
        id: 'market-1:fill',
        side: 'sell',
        price: 4121,
        label: 'Sell entry 2 @ 4121',
      }),
    ]);
  });

  it('labels reductions, exits, and reversals from the deterministic position fold', () => {
    const lifecycle: SimulationState = {
      ...state,
      fills: [
        { ...state.fills[0]!, sequence: 1, orderId: 'buy-2', side: 'buy', quantity: 2 },
        { ...state.fills[0]!, sequence: 2, orderId: 'sell-1', side: 'sell', quantity: 1 },
        { ...state.fills[0]!, sequence: 3, orderId: 'sell-2', side: 'sell', quantity: 2 },
        { ...state.fills[0]!, sequence: 4, orderId: 'buy-1', side: 'buy', quantity: 1 },
      ],
    };
    expect(
      simulationFillMarkers(lifecycle, INSTRUMENT_SPECIFICATIONS.ES).map((marker) => ({
        kind: marker.kind,
        label: marker.label,
      })),
    ).toEqual([
      { kind: 'entry_fill', label: 'Buy entry 2 @ 4121' },
      { kind: 'exit_fill', label: 'Sell reduce 1 @ 4121' },
      { kind: 'exit_fill', label: 'Sell reverse 2 @ 4121' },
      { kind: 'exit_fill', label: 'Buy exit 1 @ 4121' },
    ]);
  });
});
