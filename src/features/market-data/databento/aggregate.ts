/**
 * Deterministic 5m / 15m aggregation from native 1-minute bars.
 *
 * WHY THIS EXISTS: Databento's GLBX.MDP3 offers ohlcv-1s, ohlcv-1m, ohlcv-1h and
 * ohlcv-1d — verified via `metadata.list_schemas`
 * (https://databento.com/docs/api-reference-historical). There is NO native
 * ohlcv-5m or ohlcv-15m, so 5m and 15m must be derived. 1m and 1h are fetched
 * natively and never pass through here.
 *
 * RULE (deterministic, documented in docs/CHART_AND_BACKTESTING_DESIGN.md):
 *   bucket = floor(time / intervalSeconds) * intervalSeconds   (UTC interval start)
 *   open   = first minute's open (earliest ts in the bucket)
 *   high   = max high        low = min low
 *   close  = last minute's close (latest ts in the bucket)
 *   volume = sum of volumes
 *
 * PARTIAL / MISSING MINUTES: buckets are built only from the minutes actually
 * present. A bucket with 3 of 5 minutes yields a real bar over those 3 minutes
 * rather than being dropped or padded — no synthetic candle is ever invented,
 * and gaps stay gaps. Input order does not matter: bars are sorted first, so the
 * result is identical for any permutation of the same input.
 *
 * Pure module: no network, no SDK, no secrets.
 */
import type { Candle } from '@/features/chart/types';

export const TIMEFRAMES = ['1m', '5m', '15m', '1h'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

/** Seconds per timeframe bucket. */
export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
};

/**
 * Which provider schema backs each timeframe. 5m/15m are derived from 1m —
 * this map is the single source of truth for that decision.
 */
export const TIMEFRAME_SOURCE: Record<
  Timeframe,
  { schema: 'ohlcv-1m' | 'ohlcv-1h'; derived: boolean }
> = {
  '1m': { schema: 'ohlcv-1m', derived: false },
  '5m': { schema: 'ohlcv-1m', derived: true },
  '15m': { schema: 'ohlcv-1m', derived: true },
  '1h': { schema: 'ohlcv-1h', derived: false },
};

/** Floor a UTC epoch-second timestamp to its bucket start. */
export function bucketStart(timeSeconds: number, intervalSeconds: number): number {
  return Math.floor(timeSeconds / intervalSeconds) * intervalSeconds;
}

/**
 * Aggregate 1-minute candles into `intervalSeconds` buckets. Never mutates the
 * input. Returns bars ordered by time ascending.
 */
export function aggregateCandles(minutes: readonly Candle[], intervalSeconds: number): Candle[] {
  if (intervalSeconds <= 0) throw new Error('intervalSeconds must be positive');
  if (minutes.length === 0) return [];

  // Sort a copy so callers' arrays are untouched and output is order-independent.
  const sorted = [...minutes].sort((a, b) => a.time - b.time);
  const buckets = new Map<number, Candle>();

  for (const m of sorted) {
    const start = bucketStart(m.time, intervalSeconds);
    const existing = buckets.get(start);
    if (!existing) {
      // First (earliest, because sorted) minute defines the open.
      buckets.set(start, {
        time: start,
        open: m.open,
        high: m.high,
        low: m.low,
        close: m.close,
        volume: m.volume,
      });
      continue;
    }
    existing.high = Math.max(existing.high, m.high);
    existing.low = Math.min(existing.low, m.low);
    existing.close = m.close; // latest minute in the bucket wins
    existing.volume += m.volume;
  }

  return [...buckets.values()].sort((a, b) => a.time - b.time);
}

/** Apply the timeframe policy: derive when required, pass through otherwise. */
export function toTimeframe(candles: readonly Candle[], timeframe: Timeframe): Candle[] {
  const source = TIMEFRAME_SOURCE[timeframe];
  if (!source.derived) return [...candles].sort((a, b) => a.time - b.time);
  return aggregateCandles(candles, TIMEFRAME_SECONDS[timeframe]);
}
