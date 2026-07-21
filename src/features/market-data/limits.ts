/**
 * Shared, vendor-neutral market-data request budgets.
 *
 * This module is deliberately free of schemas, browser APIs, and provider
 * code. Server validation and the browser's bounded session planner consume
 * the same limits so a planned chunk can never be wider than the API accepts.
 */
import { TIMEFRAME_SECONDS, TIMEFRAME_SOURCE, type Timeframe } from './databento/aggregate';

export const SECONDS_PER_DAY = 86_400;

/** Maximum wall-clock span accepted by one API request. */
export const MAX_RANGE_DAYS: Record<Timeframe, number> = {
  '1m': 7,
  '5m': 7,
  '15m': 7,
  '1h': 90,
};

/** Maximum normalized bars returned by one API request. */
export const MAX_OUTPUT_ROWS = 5_000;

/** Maximum provider-source bars read by one API request. */
export const MAX_SOURCE_ROWS = 10_000;

/** Seconds per bar of the schema actually fetched. */
export function sourceBarSeconds(timeframe: Timeframe): number {
  return TIMEFRAME_SOURCE[timeframe].schema === 'ohlcv-1h' ? 3_600 : 60;
}

export function expectedSourceRows(timeframe: Timeframe, rangeSeconds: number): number {
  return Math.ceil(rangeSeconds / sourceBarSeconds(timeframe));
}

export function expectedOutputRows(timeframe: Timeframe, rangeSeconds: number): number {
  return Math.ceil(rangeSeconds / TIMEFRAME_SECONDS[timeframe]);
}

/** Tightest safe duration for one request, aligned later by the session planner. */
export function maximumRequestSeconds(timeframe: Timeframe): number {
  return Math.min(
    MAX_RANGE_DAYS[timeframe] * SECONDS_PER_DAY,
    MAX_OUTPUT_ROWS * TIMEFRAME_SECONDS[timeframe],
    MAX_SOURCE_ROWS * sourceBarSeconds(timeframe),
  );
}
