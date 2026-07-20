/**
 * Position and P&L accounting — PURE domain module.
 *
 * Folds the deterministic fill log into position state. No React, no chart
 * vendor, no clock, no randomness: the same fills and the same mark price
 * always produce the same snapshot, and the whole state can be rebuilt from
 * the log at any time (which is also how it stays consistent with replay
 * step-back semantics — recompute, never mutate).
 *
 * Money model (signed average-cost):
 *   • The open position is a signed contract count: buys +, sells −.
 *   • Adding in the same direction re-averages the entry price.
 *   • An opposite-side fill first CLOSES existing contracts, realizing
 *       (exitPrice − averageEntry) × closedQty × contractMultiplier   (long)
 *       (averageEntry − exitPrice) × closedQty × contractMultiplier   (short)
 *     Since tickValue = tickSize × contractMultiplier for every supported
 *     product, this is exactly ticks × tickValue — asserted in tests.
 *   • Quantity beyond the close REVERSES: a new position opens at the fill
 *     price, in the fill's direction.
 *   • Unrealized P&L marks the open position against the latest REVEALED
 *     candle price supplied by the caller. This module never sees the candle
 *     window, so it cannot leak future data even by accident.
 *
 * All prices are exchange prices; all P&L values are USD. The engine keeps
 * full float precision — rounding is a display concern.
 */
import type { InstrumentSpecification } from './instruments';
import type { SimulatedFill } from './types';

export type PositionSide = 'long' | 'short' | 'flat';

export interface PositionState {
  side: PositionSide;
  /** Absolute open contracts. 0 when flat. */
  quantity: number;
  /** Average entry of the OPEN position; null when flat. */
  averageEntryPrice: number | null;
  /** USD realized on closed contracts (includes closed legs of reversals). */
  realizedPnl: number;
  /** Price of the most recent position-reducing fill; null before any exit. */
  latestExitPrice: number | null;
  /** Total contracts across every fill, regardless of direction. */
  contractsTraded: number;
  fillCount: number;
}

export const FLAT_POSITION: PositionState = Object.freeze({
  side: 'flat',
  quantity: 0,
  averageEntryPrice: null,
  realizedPnl: 0,
  latestExitPrice: null,
  contractsTraded: 0,
  fillCount: 0,
});

/** Apply one fill. Pure: returns a new state, never touches the input. */
export function applyFill(
  state: PositionState,
  fill: Pick<SimulatedFill, 'side' | 'quantity' | 'price'>,
  spec: InstrumentSpecification,
): PositionState {
  const signed = fill.side === 'buy' ? fill.quantity : -fill.quantity;
  const currentSigned =
    state.side === 'flat' ? 0 : state.side === 'long' ? state.quantity : -state.quantity;

  let realizedPnl = state.realizedPnl;
  let latestExitPrice = state.latestExitPrice;
  let nextSigned: number;
  let nextAverage: number | null;

  if (currentSigned === 0 || Math.sign(currentSigned) === Math.sign(signed)) {
    // Open or add: re-average the entry over the combined size.
    const combined = Math.abs(currentSigned) + Math.abs(signed);
    nextAverage =
      currentSigned === 0
        ? fill.price
        : ((state.averageEntryPrice ?? fill.price) * Math.abs(currentSigned) +
            fill.price * Math.abs(signed)) /
          combined;
    nextSigned = currentSigned + signed;
  } else {
    // Reduce, close, or reverse.
    const closeQty = Math.min(Math.abs(currentSigned), Math.abs(signed));
    const entry = state.averageEntryPrice ?? fill.price;
    const pointsPerContract = currentSigned > 0 ? fill.price - entry : entry - fill.price;
    realizedPnl += pointsPerContract * closeQty * spec.contractMultiplier;
    latestExitPrice = fill.price;

    nextSigned = currentSigned + signed;
    if (nextSigned === 0) {
      nextAverage = null; // fully closed
    } else if (Math.sign(nextSigned) === Math.sign(currentSigned)) {
      nextAverage = state.averageEntryPrice; // partial reduce keeps the basis
    } else {
      nextAverage = fill.price; // reversal opens the remainder at this fill
    }
  }

  return {
    side: nextSigned === 0 ? 'flat' : nextSigned > 0 ? 'long' : 'short',
    quantity: Math.abs(nextSigned),
    averageEntryPrice: nextAverage,
    realizedPnl,
    latestExitPrice,
    contractsTraded: state.contractsTraded + fill.quantity,
    fillCount: state.fillCount + 1,
  };
}

/** Rebuild the whole position from the fill log. Deterministic by fold. */
export function computePosition(
  fills: readonly SimulatedFill[],
  spec: InstrumentSpecification,
): PositionState {
  let state = FLAT_POSITION;
  for (const fill of fills) state = applyFill(state, fill, spec);
  return state;
}

export interface AccountingSnapshot extends PositionState {
  /** Marked against the latest revealed price; null when flat or unmarked. */
  unrealizedPnl: number | null;
  /** realized + unrealized (unrealized counted as 0 while flat/unmarked). */
  totalPnl: number;
  /** The mark used, echoed for display; null when none was available. */
  markPrice: number | null;
}

/**
 * Position + P&L snapshot. `markPrice` MUST be the latest revealed candle
 * price — the caller owns that discipline; this module simply cannot see the
 * candle window.
 */
export function accountingSnapshot(
  fills: readonly SimulatedFill[],
  spec: InstrumentSpecification,
  markPrice: number | null,
): AccountingSnapshot {
  const position = computePosition(fills, spec);
  let unrealizedPnl: number | null = null;
  if (position.side !== 'flat' && markPrice !== null && position.averageEntryPrice !== null) {
    const points =
      position.side === 'long'
        ? markPrice - position.averageEntryPrice
        : position.averageEntryPrice - markPrice;
    unrealizedPnl = points * position.quantity * spec.contractMultiplier;
  }
  return {
    ...position,
    unrealizedPnl,
    totalPnl: position.realizedPnl + (unrealizedPnl ?? 0),
    markPrice,
  };
}

/** Format USD for display: sign, two decimals. Not for arithmetic. */
export function formatUsd(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
