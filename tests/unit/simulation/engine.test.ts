import { describe, expect, it } from 'vitest';
import type { Candle } from '@/features/chart/types';
import {
  INITIAL_SIMULATION_STATE,
  INSTRUMENT_SPECIFICATIONS,
  cancelOrder,
  cancelledOrders,
  deriveNextSequenceNumber,
  filledOrders,
  placeBracket,
  placeOrder,
  processNextCandle,
  workingOrders,
  type OrderRequest,
  type SimulationState,
} from '@/features/simulation';

function candle(index: number, values: Partial<Candle> = {}): Candle {
  return {
    time: 1_700_000_000 + index * 60,
    open: 100,
    high: 102,
    low: 98,
    close: 101,
    volume: 10,
    ...values,
  };
}

function revealed(): SimulationState {
  return processNextCandle(INITIAL_SIMULATION_STATE, candle(0), 0);
}

function request(overrides: Partial<OrderRequest> = {}): OrderRequest {
  return { id: 'order-1', symbol: 'ESZ5', side: 'buy', type: 'market', quantity: 2, ...overrides };
}

function placed(overrides: Partial<OrderRequest> = {}): SimulationState {
  const result = placeOrder(revealed(), request(overrides), {
    cursor: 0,
    candleTime: candle(0).time,
  });
  if (!result.ok) throw result.error;
  return result.value;
}

describe('pure simulated-order engine', () => {
  it.each(['buy', 'sell'] as const)('fills a %s market order at the next candle open', (side) => {
    const state = processNextCandle(placed({ side }), candle(1, { open: 103 }), 1);
    expect(filledOrders(state)[0]).toMatchObject({ side, filledPrice: 103, filledCursor: 1 });
    expect(state.fills[0]).toMatchObject({ quantity: 2, price: 103, candleTime: candle(1).time });
  });

  it('never fills on the candle used to place the order', () => {
    const state = placed();
    expect(workingOrders(state)).toHaveLength(1);
    expect(state.fills).toHaveLength(0);
  });

  it.each([
    ['buy', 100, { low: 100, high: 104 }, true],
    ['buy', 99.75, { low: 100, high: 104 }, false],
    ['sell', 102, { low: 99, high: 102 }, true],
    ['sell', 102.25, { low: 99, high: 102 }, false],
  ] as const)('%s limit at %s observes the candle range', (side, limitPrice, range, fills) => {
    const state = processNextCandle(
      placed({ side, type: 'limit', limitPrice }),
      candle(1, range),
      1,
    );
    expect(state.fills).toHaveLength(fills ? 1 : 0);
  });

  it.each([
    ['buy', 102, { low: 99, high: 102 }, true],
    ['buy', 102.25, { low: 99, high: 102 }, false],
    ['sell', 99, { low: 99, high: 102 }, true],
    ['sell', 98.75, { low: 99, high: 102 }, false],
  ] as const)('%s stop at %s observes the candle range', (side, stopPrice, range, fills) => {
    const state = processNextCandle(placed({ side, type: 'stop', stopPrice }), candle(1, range), 1);
    expect(state.fills).toHaveLength(fills ? 1 : 0);
  });

  it('applies favorable limit gap improvement', () => {
    expect(
      processNextCandle(placed({ type: 'limit', limitPrice: 100 }), candle(1, { open: 99 }), 1)
        .fills[0]?.price,
    ).toBe(99);
    expect(
      processNextCandle(
        placed({ id: 'sell', side: 'sell', type: 'limit', limitPrice: 102 }),
        candle(1, { open: 103 }),
        1,
      ).fills[0]?.price,
    ).toBe(103);
  });

  it('applies adverse stop gap behavior', () => {
    expect(
      processNextCandle(
        placed({ type: 'stop', stopPrice: 102 }),
        candle(1, { open: 103, high: 104 }),
        1,
      ).fills[0]?.price,
    ).toBe(103);
    expect(
      processNextCandle(
        placed({ id: 'sell', side: 'sell', type: 'stop', stopPrice: 99 }),
        candle(1, { open: 98, low: 97 }),
        1,
      ).fills[0]?.price,
    ).toBe(98);
  });

  it('validates quantity, finite prices, tick alignment, duplicate IDs, and supported types', () => {
    const context = { cursor: 0, candleTime: candle(0).time };
    expect(placeOrder(revealed(), request({ quantity: 1.5 }), context)).toMatchObject({
      ok: false,
      error: { code: 'invalid_quantity' },
    });
    expect(
      placeOrder(revealed(), request({ type: 'limit', limitPrice: Number.NaN }), context),
    ).toMatchObject({ ok: false, error: { code: 'invalid_price' } });
    expect(
      placeOrder(revealed(), request({ type: 'limit', limitPrice: 100.1 }), context),
    ).toMatchObject({ ok: false, error: { code: 'invalid_tick' } });
    const first = placed();
    expect(placeOrder(first, request(), context)).toMatchObject({
      ok: false,
      error: { code: 'duplicate_order' },
    });
    expect(
      placeOrder(revealed(), { ...request(), type: 'stop_limit' as 'stop' }, context),
    ).toMatchObject({ ok: false, error: { code: 'unsupported_order_type' } });
  });

  it('cancels only working orders and leaves terminal orders immutable', () => {
    const context = { cursor: 0, candleTime: candle(0).time };
    const cancelled = cancelOrder(placed(), 'order-1', context);
    expect(cancelled).toMatchObject({ ok: true });
    if (!cancelled.ok) throw cancelled.error;
    expect(cancelledOrders(cancelled.value)).toHaveLength(1);
    expect(cancelOrder(cancelled.value, 'order-1', context)).toMatchObject({
      ok: false,
      error: { code: 'terminal_order' },
    });
    const filled = processNextCandle(placed(), candle(1), 1);
    expect(cancelOrder(filled, 'order-1', { cursor: 1, candleTime: candle(1).time })).toMatchObject(
      { ok: false, error: { code: 'terminal_order' } },
    );
  });

  it('activates bracket children only after entry fill and never fills them on that candle', () => {
    const result = placeBracket(
      revealed(),
      {
        entry: request(),
        stopLoss: { id: 'sl', price: 99 },
        takeProfit: { id: 'tp', price: 101 },
        ocoGroupId: 'oco-1',
        entryReferencePrice: 100,
      },
      { cursor: 0, candleTime: candle(0).time },
    );
    if (!result.ok) throw result.error;
    expect(result.value.orders.map((order) => order.status)).toEqual([
      'working',
      'pending',
      'pending',
    ]);
    const afterEntry = processNextCandle(
      result.value,
      candle(1, { open: 100, high: 103, low: 97 }),
      1,
    );
    expect(afterEntry.orders.map((order) => order.status)).toEqual([
      'filled',
      'working',
      'working',
    ]);
    expect(afterEntry.fills).toHaveLength(1);
  });

  it('uses stop-first worst case and atomically cancels the OCO take profit', () => {
    const result = placeBracket(
      revealed(),
      {
        entry: request(),
        stopLoss: { id: 'sl', price: 99 },
        takeProfit: { id: 'tp', price: 101 },
        ocoGroupId: 'oco-1',
        entryReferencePrice: 100,
      },
      { cursor: 0, candleTime: candle(0).time },
    );
    if (!result.ok) throw result.error;
    const entryFilled = processNextCandle(result.value, candle(1, { high: 100.5, low: 99.5 }), 1);
    const bothTouched = processNextCandle(entryFilled, candle(2, { high: 102, low: 98 }), 2);
    expect(bothTouched.fills.map((fill) => fill.orderId)).toEqual(['order-1', 'sl']);
    expect(bothTouched.orders.find((order) => order.id === 'tp')?.status).toBe('cancelled');
    expect(bothTouched.orders.find((order) => order.id === 'sl')?.filledPrice).toBe(99);
  });

  it('is deterministic, immutable, sequence ordered, and always fully fills integer quantity', () => {
    const initial = revealed();
    const snapshot = structuredClone(initial);
    const first = placeOrder(initial, request(), { cursor: 0, candleTime: candle(0).time });
    const second = placeOrder(initial, request(), { cursor: 0, candleTime: candle(0).time });
    expect(first).toEqual(second);
    expect(initial).toEqual(snapshot);
    if (!first.ok) throw first.error;
    expect(first.value.orders[0]?.sequence).toBe(1);
    expect(deriveNextSequenceNumber(first.value)).toBe(2);
    const filled = processNextCandle(first.value, candle(1), 1);
    expect(filled.fills[0]?.quantity).toBe(2);
    expect(Object.isFrozen(filled.orders)).toBe(true);
    expect(Object.isFrozen(filled.fills[0])).toBe(true);
  });

  it('owns the approved instrument economics', () => {
    expect(INSTRUMENT_SPECIFICATIONS).toEqual({
      ES: { root: 'ES', tickSize: 0.25, tickValue: 12.5, contractMultiplier: 50, currency: 'USD' },
      MES: { root: 'MES', tickSize: 0.25, tickValue: 1.25, contractMultiplier: 5, currency: 'USD' },
      NQ: { root: 'NQ', tickSize: 0.25, tickValue: 5, contractMultiplier: 20, currency: 'USD' },
      MNQ: { root: 'MNQ', tickSize: 0.25, tickValue: 0.5, contractMultiplier: 2, currency: 'USD' },
    });
  });
});
