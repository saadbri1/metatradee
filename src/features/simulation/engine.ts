import type { Candle } from '@/features/chart/types';
import {
  SimulationError,
  simulationFailure,
  type SimulationErrorCode,
  type SimulationResult,
} from './errors';
import { instrumentSpecification, isTickAligned } from './instruments';
import {
  BRACKET_ROLES,
  ORDER_SIDES,
  ORDER_TYPES,
  type BracketRequest,
  type OrderContext,
  type OrderRequest,
  type SimulatedFill,
  type SimulatedOrder,
  type SimulationState,
} from './types';

export const INITIAL_SIMULATION_STATE: SimulationState = Object.freeze({
  orders: Object.freeze([]),
  fills: Object.freeze([]),
  nextSequence: 1,
  currentCursor: -1,
  currentCandleTime: null,
});
export const SIMULATION_ENGINE_VERSION = 1;

function freezeOrder(order: SimulatedOrder): SimulatedOrder {
  return Object.freeze({ ...order });
}

function freezeFill(fill: SimulatedFill): SimulatedFill {
  return Object.freeze({ ...fill });
}

function stateWith(
  state: SimulationState,
  patch: Partial<
    Pick<
      SimulationState,
      'orders' | 'fills' | 'nextSequence' | 'currentCursor' | 'currentCandleTime'
    >
  >,
): SimulationState {
  return Object.freeze({
    ...state,
    ...patch,
    orders: Object.freeze((patch.orders ?? state.orders).map(freezeOrder)),
    fills: Object.freeze((patch.fills ?? state.fills).map(freezeFill)),
  });
}

function validContext(state: SimulationState, context: OrderContext): boolean {
  return (
    Number.isInteger(context.cursor) &&
    context.cursor >= 0 &&
    Number.isInteger(context.candleTime) &&
    context.candleTime > 0 &&
    context.cursor === state.currentCursor &&
    context.candleTime === state.currentCandleTime
  );
}

function requestedPrice(request: OrderRequest): number | undefined {
  return request.type === 'limit'
    ? request.limitPrice
    : request.type === 'stop'
      ? request.stopPrice
      : undefined;
}

function validateOrder(
  state: SimulationState,
  request: OrderRequest,
  context: OrderContext,
): SimulationResult<true> {
  if (
    !validContext(state, context) ||
    typeof request.id !== 'string' ||
    request.id.trim() !== request.id ||
    request.id.length === 0 ||
    !instrumentSpecification(request.symbol)
  ) {
    return simulationFailure('invalid_order');
  }
  if (!ORDER_SIDES.includes(request.side)) return simulationFailure('invalid_order');
  if (!ORDER_TYPES.includes(request.type)) return simulationFailure('unsupported_order_type');
  if (request.role !== undefined && !BRACKET_ROLES.includes(request.role))
    return simulationFailure('invalid_order');
  if (!Number.isSafeInteger(request.quantity) || request.quantity <= 0)
    return simulationFailure('invalid_quantity');
  if (state.orders.some((order) => order.id === request.id))
    return simulationFailure('duplicate_order');
  const specification = instrumentSpecification(request.symbol)!;
  if (request.type === 'market') {
    if (request.limitPrice !== undefined || request.stopPrice !== undefined)
      return simulationFailure('invalid_price');
  } else {
    const price = requestedPrice(request);
    if (!Number.isFinite(price)) return simulationFailure('invalid_price');
    if (request.type === 'limit' && request.stopPrice !== undefined)
      return simulationFailure('invalid_price');
    if (request.type === 'stop' && request.limitPrice !== undefined)
      return simulationFailure('invalid_price');
    if (!isTickAligned(price!, specification.tickSize)) return simulationFailure('invalid_tick');
  }
  if ((request.role === 'stop_loss' || request.role === 'take_profit') && !request.parentOrderId) {
    return simulationFailure('invalid_bracket');
  }
  if (request.parentOrderId) {
    const parent = state.orders.find((order) => order.id === request.parentOrderId);
    if (!parent || parent.role !== 'entry') return simulationFailure('invalid_bracket');
    if (
      request.side === parent.side ||
      request.symbol !== parent.symbol ||
      request.quantity !== parent.quantity ||
      !request.ocoGroupId ||
      (request.role !== 'stop_loss' && request.role !== 'take_profit') ||
      (request.role === 'stop_loss' && request.type !== 'stop') ||
      (request.role === 'take_profit' && request.type !== 'limit')
    ) {
      return simulationFailure('invalid_bracket');
    }
    const parentPrice = parent.filledPrice ?? requestedPrice(parent);
    const childPrice = requestedPrice(request);
    if (
      parentPrice !== undefined &&
      childPrice !== undefined &&
      !relationIsValid(parent.side, request.role, childPrice, parentPrice)
    ) {
      return simulationFailure(
        request.role === 'stop_loss' ? 'invalid_stop_loss' : 'invalid_take_profit',
      );
    }
  } else if (request.role === 'stop_loss' || request.role === 'take_profit' || request.ocoGroupId) {
    return simulationFailure('invalid_bracket');
  }
  return { ok: true, value: true };
}

function addOrder(
  state: SimulationState,
  request: OrderRequest,
  context: OrderContext,
  status: 'pending' | 'working',
): SimulationState {
  const order: SimulatedOrder = {
    ...request,
    role: request.role ?? 'entry',
    sequence: state.nextSequence,
    status,
    createdCursor: context.cursor,
    createdCandleTime: context.candleTime,
    eligibleAfterCursor: context.cursor,
  };
  return stateWith(state, {
    orders: [...state.orders, order],
    nextSequence: state.nextSequence + 1,
  });
}

export function placeOrder(
  state: SimulationState,
  request: OrderRequest,
  context: OrderContext,
): SimulationResult<SimulationState> {
  const validation = validateOrder(state, request, context);
  if (!validation.ok) return validation;
  return { ok: true, value: addOrder(state, request, context, 'working') };
}

/** Convert a validation decision into the stable typed rejection result used by callers. */
export function rejectInvalidOrder<T = never>(
  code: SimulationErrorCode = 'invalid_order',
): SimulationResult<T> {
  return simulationFailure(code);
}

function relationIsValid(
  side: 'buy' | 'sell',
  role: 'stop_loss' | 'take_profit',
  price: number,
  entryPrice: number,
): boolean {
  if (role === 'stop_loss') return side === 'buy' ? price < entryPrice : price > entryPrice;
  return side === 'buy' ? price > entryPrice : price < entryPrice;
}

export function placeBracket(
  state: SimulationState,
  request: BracketRequest,
  context: OrderContext,
): SimulationResult<SimulationState> {
  if (
    (!request.stopLoss && !request.takeProfit) ||
    !request.ocoGroupId ||
    state.orders.some((order) => order.ocoGroupId === request.ocoGroupId)
  )
    return simulationFailure('invalid_bracket');
  const entry = {
    ...request.entry,
    role: 'entry' as const,
    parentOrderId: undefined,
    ocoGroupId: undefined,
  };
  const entryValidation = validateOrder(state, entry, context);
  if (!entryValidation.ok) return entryValidation;
  const entryPrice = requestedPrice(entry) ?? request.entryReferencePrice;
  if (entryPrice !== undefined && !Number.isFinite(entryPrice))
    return simulationFailure('invalid_price');
  if (
    request.stopLoss &&
    entryPrice !== undefined &&
    !relationIsValid(entry.side, 'stop_loss', request.stopLoss.price, entryPrice)
  ) {
    return simulationFailure('invalid_stop_loss');
  }
  if (
    request.takeProfit &&
    entryPrice !== undefined &&
    !relationIsValid(entry.side, 'take_profit', request.takeProfit.price, entryPrice)
  ) {
    return simulationFailure('invalid_take_profit');
  }
  let next = addOrder(state, entry, context, 'working');
  const exitSide = entry.side === 'buy' ? 'sell' : 'buy';
  if (request.stopLoss) {
    const child: OrderRequest = {
      id: request.stopLoss.id,
      symbol: entry.symbol,
      side: exitSide,
      type: 'stop',
      quantity: entry.quantity,
      stopPrice: request.stopLoss.price,
      role: 'stop_loss',
      parentOrderId: entry.id,
      ocoGroupId: request.ocoGroupId,
    };
    const validation = validateOrder(next, child, context);
    if (!validation.ok) return validation;
    next = addOrder(next, child, context, 'pending');
  }
  if (request.takeProfit) {
    const child: OrderRequest = {
      id: request.takeProfit.id,
      symbol: entry.symbol,
      side: exitSide,
      type: 'limit',
      quantity: entry.quantity,
      limitPrice: request.takeProfit.price,
      role: 'take_profit',
      parentOrderId: entry.id,
      ocoGroupId: request.ocoGroupId,
    };
    const validation = validateOrder(next, child, context);
    if (!validation.ok) return validation;
    next = addOrder(next, child, context, 'pending');
  }
  return { ok: true, value: next };
}

function fillPrice(order: SimulatedOrder, candle: Candle): number | null {
  if (order.type === 'market') return candle.open;
  if (order.type === 'limit') {
    const limit = order.limitPrice!;
    if (order.side === 'buy' && candle.low <= limit) return Math.min(candle.open, limit);
    if (order.side === 'sell' && candle.high >= limit) return Math.max(candle.open, limit);
    return null;
  }
  if (order.type === 'stop') {
    const stop = order.stopPrice!;
    if (order.side === 'buy' && candle.high >= stop) return Math.max(candle.open, stop);
    if (order.side === 'sell' && candle.low <= stop) return Math.min(candle.open, stop);
  }
  return null;
}

function cancelOcoSibling(
  orders: readonly SimulatedOrder[],
  filled: SimulatedOrder,
  cursor: number,
  candleTime: number,
): SimulatedOrder[] {
  if (!filled.ocoGroupId) return [...orders];
  return orders.map((order) =>
    order.id !== filled.id && order.ocoGroupId === filled.ocoGroupId && order.status === 'working'
      ? { ...order, status: 'cancelled', cancelledCursor: cursor, cancelledCandleTime: candleTime }
      : order,
  );
}

function activateChildren(
  orders: readonly SimulatedOrder[],
  parent: SimulatedOrder,
  cursor: number,
): SimulatedOrder[] {
  return orders.map((order) => {
    if (order.parentOrderId !== parent.id || order.status !== 'pending') return order;
    const price = requestedPrice(order)!;
    if (
      !relationIsValid(
        parent.side,
        order.role as 'stop_loss' | 'take_profit',
        price,
        parent.filledPrice!,
      )
    ) {
      return {
        ...order,
        status: 'rejected',
        rejectionCode: order.role === 'stop_loss' ? 'invalid_stop_loss' : 'invalid_take_profit',
      };
    }
    return { ...order, status: 'working', eligibleAfterCursor: cursor };
  });
}

export function activateBracketChildren(
  state: SimulationState,
  parentOrderId: string,
  context: OrderContext,
): SimulationResult<SimulationState> {
  if (!validContext(state, context)) return simulationFailure('invalid_order');
  const parent = state.orders.find((order) => order.id === parentOrderId);
  if (!parent) return simulationFailure('order_not_found');
  if (parent.role !== 'entry' || parent.status !== 'filled') {
    return simulationFailure('invalid_bracket');
  }
  return {
    ok: true,
    value: stateWith(state, { orders: activateChildren(state.orders, parent, context.cursor) }),
  };
}

export function processNextCandle(
  state: SimulationState,
  candle: Candle,
  cursor: number,
): SimulationState {
  if (
    !Number.isInteger(cursor) ||
    cursor !== state.currentCursor + 1 ||
    !Number.isInteger(candle.time) ||
    candle.time <= 0 ||
    (state.currentCandleTime !== null && candle.time <= state.currentCandleTime) ||
    [candle.open, candle.high, candle.low, candle.close, candle.volume].some(
      (value) => !Number.isFinite(value),
    )
  ) {
    throw new SimulationError('invalid_order');
  }
  let orders = state.orders.map((order) => ({ ...order }));
  const fills = state.fills.map((fill) => ({ ...fill }));
  const candidates = orders
    .filter((order) => order.status === 'working' && cursor > order.eligibleAfterCursor)
    .sort((a, b) => a.sequence - b.sequence);
  for (const candidate of candidates) {
    const live = orders.find((order) => order.id === candidate.id)!;
    if (live.status !== 'working') continue;
    const price = fillPrice(live, candle);
    if (price === null) continue;
    const filled: SimulatedOrder = {
      ...live,
      status: 'filled',
      filledPrice: price,
      filledCursor: cursor,
      filledCandleTime: candle.time,
    };
    orders = orders.map((order) => (order.id === filled.id ? filled : order));
    fills.push({
      sequence: fills.length + 1,
      orderId: filled.id,
      side: filled.side,
      quantity: filled.quantity,
      price,
      candleTime: candle.time,
      cursor,
      role: filled.role,
    });
    if (filled.role === 'entry') orders = activateChildren(orders, filled, cursor);
    else orders = cancelOcoSibling(orders, filled, cursor, candle.time);
  }
  return stateWith(state, { orders, fills, currentCursor: cursor, currentCandleTime: candle.time });
}

export function cancelOrder(
  state: SimulationState,
  orderId: string,
  context: OrderContext,
): SimulationResult<SimulationState> {
  if (!validContext(state, context)) return simulationFailure('invalid_order');
  const order = state.orders.find((candidate) => candidate.id === orderId);
  if (!order) return simulationFailure('order_not_found');
  if (order.status === 'filled' || order.status === 'cancelled' || order.status === 'rejected')
    return simulationFailure('terminal_order');
  if (order.status !== 'working') return simulationFailure('order_not_working');
  const orders = state.orders.map((candidate) =>
    candidate.id === orderId
      ? {
          ...candidate,
          status: 'cancelled' as const,
          cancelledCursor: context.cursor,
          cancelledCandleTime: context.candleTime,
        }
      : candidate,
  );
  return { ok: true, value: stateWith(state, { orders }) };
}

export function workingOrders(state: SimulationState): readonly SimulatedOrder[] {
  return state.orders.filter((order) => order.status === 'working');
}
export function filledOrders(state: SimulationState): readonly SimulatedOrder[] {
  return state.orders.filter((order) => order.status === 'filled');
}
export function cancelledOrders(state: SimulationState): readonly SimulatedOrder[] {
  return state.orders.filter((order) => order.status === 'cancelled');
}
export function activeBracket(
  state: SimulationState,
  parentOrderId: string,
): readonly SimulatedOrder[] {
  return state.orders.filter(
    (order) =>
      order.parentOrderId === parentOrderId &&
      (order.status === 'pending' || order.status === 'working'),
  );
}
export function deriveNextSequenceNumber(state: SimulationState): number {
  return state.nextSequence;
}
