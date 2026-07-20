import type { Candle } from '@/features/chart/types';
import {
  cancelOrder,
  INITIAL_SIMULATION_STATE,
  placeBracket,
  placeOrder,
  processNextCandle,
} from './engine';
import type { SimulationResult } from './errors';
import type { BracketRequest, OrderRequest, SimulationState } from './types';

export type SimulationEvent =
  | {
      sequence: number;
      type: 'place_order';
      cursor: number;
      candleTime: number;
      request: OrderRequest;
    }
  | {
      sequence: number;
      type: 'place_bracket';
      cursor: number;
      candleTime: number;
      request: BracketRequest;
    }
  | { sequence: number; type: 'cancel_order'; cursor: number; candleTime: number; orderId: string };

type NewSimulationEvent =
  | Omit<Extract<SimulationEvent, { type: 'place_order' }>, 'sequence'>
  | Omit<Extract<SimulationEvent, { type: 'place_bracket' }>, 'sequence'>
  | Omit<Extract<SimulationEvent, { type: 'cancel_order' }>, 'sequence'>;

export interface SimulationSession {
  readonly state: SimulationState;
  readonly events: readonly SimulationEvent[];
  readonly nextEventSequence: number;
}

function freezeEvent(event: SimulationEvent): SimulationEvent {
  if (event.type === 'cancel_order') return Object.freeze({ ...event });
  if (event.type === 'place_order')
    return Object.freeze({ ...event, request: Object.freeze({ ...event.request }) });
  return Object.freeze({
    ...event,
    request: Object.freeze({
      ...event.request,
      entry: Object.freeze({ ...event.request.entry }),
      stopLoss: event.request.stopLoss ? Object.freeze({ ...event.request.stopLoss }) : undefined,
      takeProfit: event.request.takeProfit
        ? Object.freeze({ ...event.request.takeProfit })
        : undefined,
    }),
  });
}

function sessionWith(
  session: SimulationSession,
  state: SimulationState,
  events = session.events,
): SimulationSession {
  return Object.freeze({
    state,
    events: Object.freeze(events.map(freezeEvent)),
    nextEventSequence: session.nextEventSequence + (events === session.events ? 0 : 1),
  });
}

function applyEvent(state: SimulationState, event: SimulationEvent): SimulationState {
  const context = { cursor: event.cursor, candleTime: event.candleTime };
  const result =
    event.type === 'place_order'
      ? placeOrder(state, event.request, context)
      : event.type === 'place_bracket'
        ? placeBracket(state, event.request, context)
        : cancelOrder(state, event.orderId, context);
  if (!result.ok) throw new Error(`Deterministic simulation event rejected: ${result.error.code}`);
  return result.value;
}

export function rebuildSimulation(
  candles: readonly Candle[],
  events: readonly SimulationEvent[],
  targetCursor: number,
): SimulationState {
  if (!Number.isInteger(targetCursor) || targetCursor < 0 || targetCursor >= candles.length) {
    throw new Error('Simulation target cursor is outside the candle window.');
  }
  let state = INITIAL_SIMULATION_STATE;
  const orderedEvents = [...events].sort((a, b) => a.sequence - b.sequence);
  for (let cursor = 0; cursor <= targetCursor; cursor += 1) {
    state = processNextCandle(state, candles[cursor]!, cursor);
    for (const event of orderedEvents.filter((candidate) => candidate.cursor === cursor)) {
      state = applyEvent(state, event);
    }
  }
  return state;
}

export function initializeSimulationSession(
  candles: readonly Candle[],
  cursor = 0,
): SimulationSession {
  return Object.freeze({
    state: rebuildSimulation(candles, [], cursor),
    events: Object.freeze([]),
    nextEventSequence: 1,
  });
}

export function moveSimulation(
  session: SimulationSession,
  candles: readonly Candle[],
  targetCursor: number,
): SimulationSession {
  if (!Number.isInteger(targetCursor) || targetCursor < 0 || targetCursor >= candles.length) {
    throw new Error('Simulation target cursor is outside the candle window.');
  }
  if (targetCursor < session.state.currentCursor) {
    return Object.freeze({
      ...session,
      state: rebuildSimulation(candles, session.events, targetCursor),
    });
  }
  if (targetCursor === session.state.currentCursor) return session;
  let state = session.state;
  for (let cursor = state.currentCursor + 1; cursor <= targetCursor; cursor += 1) {
    state = processNextCandle(state, candles[cursor]!, cursor);
    for (const event of session.events
      .filter((candidate) => candidate.cursor === cursor)
      .sort((a, b) => a.sequence - b.sequence)) {
      state = applyEvent(state, event);
    }
  }
  return Object.freeze({ ...session, state });
}

function recordEvent(
  session: SimulationSession,
  event: NewSimulationEvent,
  result: SimulationResult<SimulationState>,
): SimulationResult<SimulationSession> {
  if (!result.ok) return result;
  const recorded = freezeEvent({
    ...event,
    sequence: session.nextEventSequence,
  } as SimulationEvent);
  return {
    ok: true,
    value: sessionWith(session, result.value, [...session.events, recorded]),
  };
}

export function recordOrder(
  session: SimulationSession,
  request: OrderRequest,
): SimulationResult<SimulationSession> {
  const context = {
    cursor: session.state.currentCursor,
    candleTime: session.state.currentCandleTime!,
  };
  return recordEvent(
    session,
    { type: 'place_order', ...context, request },
    placeOrder(session.state, request, context),
  );
}

export function recordBracket(
  session: SimulationSession,
  request: BracketRequest,
): SimulationResult<SimulationSession> {
  const context = {
    cursor: session.state.currentCursor,
    candleTime: session.state.currentCandleTime!,
  };
  return recordEvent(
    session,
    { type: 'place_bracket', ...context, request },
    placeBracket(session.state, request, context),
  );
}

export function recordCancellation(
  session: SimulationSession,
  orderId: string,
): SimulationResult<SimulationSession> {
  const context = {
    cursor: session.state.currentCursor,
    candleTime: session.state.currentCandleTime!,
  };
  return recordEvent(
    session,
    { type: 'cancel_order', ...context, orderId },
    cancelOrder(session.state, orderId, context),
  );
}
