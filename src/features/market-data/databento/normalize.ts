/**
 * Provider row → vendor-free `Candle` normalization.
 *
 * Two provider specifics are handled here and NOWHERE else, both verified from
 * official Databento documentation (https://databento.com/docs/schemas-and-data-formats):
 *   1. OHLCV prices are fixed-point where "1 unit equals 1e-9" → divide by 1e9.
 *      Passing raw values through would render prices ~1e9x wrong.
 *   2. `ts_event` is the START of the interval. Databento timestamps are UTC
 *      nanoseconds, while the MetaTradee `Candle` uses UTC epoch SECONDS
 *      (src/features/chart/types.ts) → divide by 1e9 and floor.
 *
 * Malformed rows are REJECTED, never coerced — a silently repaired candle is a
 * wrong price on a chart. Pure module: no network, no SDK, no secrets.
 */
import type { Candle } from '@/features/chart/types';

/** Nanoseconds per second, and the fixed-point price divisor (both 1e9). */
const NANOS_PER_SECOND = 1_000_000_000;
const PRICE_SCALE = 1_000_000_000;

/** Shape of one raw OHLCV row as delivered by the provider. */
export interface RawOhlcvRow {
  ts_event?: unknown;
  open?: unknown;
  high?: unknown;
  low?: unknown;
  close?: unknown;
  volume?: unknown;
}

function finiteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  // Databento may deliver 64-bit fields as strings; accept only clean numerics.
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Normalize one row. Returns null when the row cannot be trusted. */
export function normalizeRow(row: RawOhlcvRow): Candle | null {
  const tsNanos = finiteNumber(row.ts_event);
  const open = finiteNumber(row.open);
  const high = finiteNumber(row.high);
  const low = finiteNumber(row.low);
  const close = finiteNumber(row.close);
  const volume = finiteNumber(row.volume);
  if (
    tsNanos === null ||
    open === null ||
    high === null ||
    low === null ||
    close === null ||
    volume === null
  ) {
    return null;
  }

  const candle: Candle = {
    time: Math.floor(tsNanos / NANOS_PER_SECOND),
    open: open / PRICE_SCALE,
    high: high / PRICE_SCALE,
    low: low / PRICE_SCALE,
    close: close / PRICE_SCALE,
    volume,
  };

  // Structural sanity: a bar whose range cannot contain its own open/close is
  // corrupt, and negative prices/volume are impossible. Reject rather than ship.
  if (candle.time <= 0 || candle.volume < 0) return null;
  if (candle.low > candle.high) return null;
  if (candle.open < candle.low || candle.open > candle.high) return null;
  if (candle.close < candle.low || candle.close > candle.high) return null;
  for (const v of [candle.open, candle.high, candle.low, candle.close]) {
    if (v <= 0) return null;
  }
  return candle;
}

/** Normalize a page of rows, dropping malformed ones and sorting by time. */
export function normalizeRows(rows: readonly RawOhlcvRow[]): Candle[] {
  const out: Candle[] = [];
  for (const row of rows) {
    const c = normalizeRow(row);
    if (c) out.push(c);
  }
  return out.sort((a, b) => a.time - b.time);
}
