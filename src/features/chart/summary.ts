/**
 * Display-only summary derivation for a candle series.
 *
 * Lives OUTSIDE `fixtures.ts` deliberately. This function is used by the
 * production chart path, and fixtures are development-only data; keeping them
 * in the same module meant the production route imported the fixture module and
 * a synthetic series was always one call away from being rendered for real.
 * Separating them makes "no fixture in production" checkable by grep.
 *
 * Pure: never mutates its input.
 */
import type { Candle, CandleSummary } from './types';

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Derive the display-only summary. Pure; never mutates its input. */
export function summarizeCandles(candles: readonly Candle[]): CandleSummary {
  if (candles.length === 0) {
    return {
      count: 0,
      first: null,
      last: null,
      high: null,
      low: null,
      change: null,
      changePercent: null,
      totalVolume: 0,
    };
  }
  const first = candles[0]!;
  const last = candles[candles.length - 1]!;
  let high = first.high;
  let low = first.low;
  let totalVolume = 0;
  for (const c of candles) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
    totalVolume += c.volume;
  }
  const change = round2(last.close - first.open);
  const changePercent = first.open === 0 ? null : round2((change / first.open) * 100);

  return { count: candles.length, first, last, high, low, change, changePercent, totalVolume };
}
