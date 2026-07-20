'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Candle } from '@/features/chart/types';
import type { ReplayState } from '@/features/replay';
import {
  initializeSimulationSession,
  moveSimulation,
  recordBracket,
  recordCancellation,
  recordOrder,
  type SimulationSession,
} from './replay';
import type { SimulationResult } from './errors';
import type { BracketRequest, OrderRequest } from './types';

function fillAnnouncement(
  previous: SimulationSession | null,
  next: SimulationSession,
): string | null {
  const messages: string[] = [];
  const oldFills = previous?.state.fills.length ?? 0;
  const fill = next.state.fills.at(-1);
  if (next.state.fills.length > oldFills && fill) {
    messages.push(
      `${fill.side === 'buy' ? 'Buy' : 'Sell'} order filled: ${fill.quantity} at ${fill.price}.`,
    );
    if (
      fill.role === 'entry' &&
      next.state.orders.some(
        (order) => order.parentOrderId === fill.orderId && order.status === 'working',
      )
    ) {
      messages.push('Bracket exit orders working.');
    }
  }
  const oldCancelled =
    previous?.state.orders.filter((order) => order.status === 'cancelled').length ?? 0;
  const cancelled = next.state.orders.filter((order) => order.status === 'cancelled');
  if (cancelled.length > oldCancelled) {
    messages.push(`Order ${cancelled.at(-1)!.id} cancelled.`);
  }
  const oldRejected =
    previous?.state.orders.filter((order) => order.status === 'rejected').length ?? 0;
  const rejected = next.state.orders.filter((order) => order.status === 'rejected');
  if (rejected.length > oldRejected) {
    messages.push(`Order ${rejected.at(-1)!.id} rejected.`);
  }
  return messages.length > 0 ? messages.join(' ') : null;
}

export function useSimulation(replay: ReplayState, candles: readonly Candle[]) {
  const [session, setSession] = useState<SimulationSession | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const sessionRef = useRef<SimulationSession | null>(null);

  const commit = useCallback((next: SimulationSession | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  useEffect(() => {
    if (replay.status === 'idle') {
      if (sessionRef.current) commit(null);
      setAnnouncement('');
      return;
    }
    const previous = sessionRef.current;
    const next = previous
      ? moveSimulation(previous, candles, replay.cursor)
      : initializeSimulationSession(candles, replay.cursor);
    if (next !== previous) {
      commit(next);
      const message = fillAnnouncement(previous, next);
      if (message) setAnnouncement(message);
    }
  }, [candles, commit, replay.cursor, replay.status]);

  const apply = useCallback(
    (
      operation: (current: SimulationSession) => SimulationResult<SimulationSession>,
      workingMessage: string,
    ): SimulationResult<SimulationSession> | null => {
      const current = sessionRef.current;
      if (!current) return null;
      const result = operation(current);
      if (result.ok) {
        commit(result.value);
        setAnnouncement(workingMessage);
      } else {
        setAnnouncement(`Order rejected: ${result.error.message}`);
      }
      return result;
    },
    [commit],
  );

  const place = useCallback(
    (request: OrderRequest) =>
      apply(
        (current) => recordOrder(current, request),
        `${request.side === 'buy' ? 'Buy' : 'Sell'} ${request.type} order working.`,
      ),
    [apply],
  );
  const placeWithBracket = useCallback(
    (request: BracketRequest) =>
      apply(
        (current) => recordBracket(current, request),
        `${request.entry.side === 'buy' ? 'Buy' : 'Sell'} ${request.entry.type} bracket order working.`,
      ),
    [apply],
  );
  const cancel = useCallback(
    (orderId: string) =>
      apply((current) => recordCancellation(current, orderId), `Order ${orderId} cancelled.`),
    [apply],
  );
  const discard = useCallback(() => {
    commit(null);
    setAnnouncement('');
  }, [commit]);

  return {
    session,
    state: session?.state ?? null,
    announcement,
    place,
    placeBracket: placeWithBracket,
    cancel,
    discard,
  };
}

export type SimulationController = ReturnType<typeof useSimulation>;
