/**
 * Position sizing. PURE — no clock, no network, no formatting.
 *
 * THE WHOLE FORMULA, and the reason it is this short:
 *
 *     risk amount  = balance × risk%
 *     loss per lot = stop distance in PRICE × contract size
 *     lots         = risk amount ÷ loss per lot
 *
 * Working in price distance rather than pips is what keeps it one formula
 * instead of six. A gold stop of "$5" and a EURUSD stop of "20 pips" are the
 * same kind of quantity once both are expressed as a price move, and every
 * instrument then differs only by its contract size.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It does not convert currencies. The
 * result is exact when the instrument's quote currency matches the account
 * currency — the common case for a USD account trading XAUUSD or EURUSD — and
 * for anything else the answer is in the QUOTE currency and the caller is told
 * so, rather than being handed a number silently computed from a hardcoded
 * exchange rate that would be wrong within the hour.
 *
 * It also does not model leverage, margin, commission or swap. Those change
 * whether a position is affordable; they do not change what a stop-out costs,
 * which is what sizing is for.
 */

export interface PositionSizeInput {
  /** Account balance in the account currency. */
  balance: number;
  /** Percentage of balance to risk, e.g. `1` for one percent. */
  riskPercent: number;
  /** Distance from entry to stop, as a PRICE difference. Always positive. */
  stopDistance: number;
  /** Units of the base instrument in one standard lot. */
  contractSize: number;
}

export type PositionSizeError =
  'balance_invalid' | 'risk_invalid' | 'stop_invalid' | 'contract_invalid';

export interface PositionSizeResult {
  /** Money placed at risk if the stop is hit, in the quote currency. */
  riskAmount: number;
  /** What one standard lot loses at this stop distance. */
  lossPerLot: number;
  /** Position size in standard lots, unrounded. */
  lots: number;
  /** Units of the base instrument (lots × contract size). */
  units: number;
  /** Money moved by a one-unit price change, at the computed size. */
  valuePerPricePoint: number;
}

export type PositionSizeOutcome =
  { ok: true; result: PositionSizeResult } | { ok: false; error: PositionSizeError };

/**
 * Every bound here rejects a value that would produce a confidently wrong
 * number rather than an obviously broken one. A zero stop distance is the
 * dangerous case: it divides to `Infinity`, which renders as a position size no
 * account could take, so it is refused at the door.
 */
export function calculatePositionSize(input: PositionSizeInput): PositionSizeOutcome {
  const { balance, riskPercent, stopDistance, contractSize } = input;

  if (!Number.isFinite(balance) || balance <= 0) return { ok: false, error: 'balance_invalid' };
  if (!Number.isFinite(riskPercent) || riskPercent <= 0 || riskPercent > 100) {
    return { ok: false, error: 'risk_invalid' };
  }
  if (!Number.isFinite(stopDistance) || stopDistance <= 0)
    return { ok: false, error: 'stop_invalid' };
  if (!Number.isFinite(contractSize) || contractSize <= 0) {
    return { ok: false, error: 'contract_invalid' };
  }

  const riskAmount = balance * (riskPercent / 100);
  const lossPerLot = stopDistance * contractSize;
  const lots = riskAmount / lossPerLot;

  return {
    ok: true,
    result: {
      riskAmount,
      lossPerLot,
      lots,
      units: lots * contractSize,
      valuePerPricePoint: lots * contractSize,
    },
  };
}

/** Pips → price distance. The calculator works in price; this is the adapter. */
export function pipsToPrice(pips: number, pipSize: number): number {
  return pips * pipSize;
}

/** Price distance → pips, for showing the stop back in familiar units. */
export function priceToPips(price: number, pipSize: number): number {
  return pipSize === 0 ? 0 : price / pipSize;
}

/**
 * Round DOWN to a tradeable lot step.
 *
 * Down, never nearest. Rounding 0.47 up to 0.5 quietly risks more than the
 * trader asked for, and the entire point of the calculation was the number they
 * asked for. Under-risking is a smaller loss than over-risking.
 */
export function roundLotsDown(lots: number, step = 0.01): number {
  if (!Number.isFinite(lots) || lots <= 0 || step <= 0) return 0;
  const rounded = Math.floor(lots / step) * step;
  // Re-round to the step's own precision; float division reintroduces noise.
  const decimals = Math.max(0, Math.ceil(-Math.log10(step)));
  return Number(rounded.toFixed(decimals));
}
