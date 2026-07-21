/**
 * Pure planning and assembly for a bounded historical chart session.
 *
 * A session may span one calendar month, while each authenticated API call
 * remains inside the existing cost limits. Chunk boundaries are deterministic,
 * contiguous, and aligned to the requested timeframe so derived bars are not
 * split across requests.
 */
import type { Timeframe } from '@/features/market-data/databento/aggregate';
import { TIMEFRAME_SECONDS } from '@/features/market-data/databento/aggregate';
import { maximumRequestSeconds } from '@/features/market-data/limits';
import type { Candle } from './types';

export interface CandleSessionRequest {
  symbol: string;
  timeframe: Timeframe;
  start: string;
  end: string;
}

export type CandleSessionChunk = CandleSessionRequest;

export interface CandleSessionPart {
  symbol: string;
  timeframe: string;
  start: string;
  end: string;
  provider: string;
  candles: readonly Candle[];
}

export interface AssembledCandleSession {
  symbol: string;
  timeframe: string;
  start: string;
  end: string;
  provider: string;
  candles: Candle[];
}

export class CandleSessionPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CandleSessionPlanError';
  }
}

function parseUtc(value: string, field: 'start' | 'end'): number {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || !value.endsWith('Z')) {
    throw new CandleSessionPlanError(`${field} must be an ISO 8601 UTC datetime.`);
  }
  return milliseconds;
}

/** Same UTC wall-clock time one calendar month later, clamped to month end. */
export function oneCalendarMonthAfter(start: string): string {
  const startMs = parseUtc(start, 'start');
  const date = new Date(startMs);
  const targetMonth = date.getUTCMonth() + 1;
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = targetMonth % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDay);
  return new Date(
    Date.UTC(
      targetYear,
      normalizedMonth,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  ).toISOString();
}

/**
 * Plan the initial load. This is the only place that expands a session into
 * multiple browser requests; replay itself consumes the assembled array only.
 */
export function planCandleSession(request: CandleSessionRequest): readonly CandleSessionChunk[] {
  const startMs = parseUtc(request.start, 'start');
  const endMs = parseUtc(request.end, 'end');
  if (startMs >= endMs) throw new CandleSessionPlanError('end must be after start.');
  if (endMs > Date.parse(oneCalendarMonthAfter(request.start))) {
    throw new CandleSessionPlanError('Replay sessions support at most one calendar month.');
  }

  const intervalMs = TIMEFRAME_SECONDS[request.timeframe] * 1_000;
  const maximumChunkMs = maximumRequestSeconds(request.timeframe) * 1_000;
  const chunks: CandleSessionChunk[] = [];
  let cursor = startMs;

  while (cursor < endMs) {
    let chunkEnd = Math.min(cursor + maximumChunkMs, endMs);
    if (chunkEnd < endMs) {
      // Align internal boundaries to the timeframe's UTC buckets. This avoids
      // building two partial 5m/15m bars for one logical interval.
      chunkEnd = Math.floor(chunkEnd / intervalMs) * intervalMs;
      if (chunkEnd <= cursor) chunkEnd = Math.min(cursor + intervalMs, endMs);
    }
    chunks.push(
      Object.freeze({
        ...request,
        start: cursor === startMs ? request.start : new Date(cursor).toISOString(),
        end: chunkEnd === endMs ? request.end : new Date(chunkEnd).toISOString(),
      }),
    );
    cursor = chunkEnd;
  }

  return Object.freeze(chunks);
}

function sameCandle(a: Candle, b: Candle): boolean {
  return (
    a.time === b.time &&
    a.open === b.open &&
    a.high === b.high &&
    a.low === b.low &&
    a.close === b.close &&
    a.volume === b.volume
  );
}

/** Assemble normalized chunks, rejecting conflicting overlap or metadata. */
export function assembleCandleSession(
  request: CandleSessionRequest,
  parts: readonly CandleSessionPart[],
): AssembledCandleSession {
  const startSeconds = parseUtc(request.start, 'start') / 1_000;
  const endSeconds = parseUtc(request.end, 'end') / 1_000;
  const byTime = new Map<number, Candle>();
  let provider: string | null = null;

  for (const part of parts) {
    if (part.symbol !== request.symbol || part.timeframe !== request.timeframe) {
      throw new CandleSessionPlanError('A candle chunk returned mismatched session metadata.');
    }
    if (provider !== null && part.provider !== provider) {
      throw new CandleSessionPlanError('A candle session cannot combine different providers.');
    }
    provider = part.provider;
    for (const candle of part.candles) {
      if (candle.time < startSeconds || candle.time >= endSeconds) {
        throw new CandleSessionPlanError(
          'A candle chunk returned data outside the requested range.',
        );
      }
      const existing = byTime.get(candle.time);
      if (existing && !sameCandle(existing, candle)) {
        throw new CandleSessionPlanError('Overlapping candle chunks returned conflicting prices.');
      }
      if (!existing) byTime.set(candle.time, { ...candle });
    }
  }

  return {
    symbol: request.symbol,
    timeframe: request.timeframe,
    start: request.start,
    end: request.end,
    provider: provider ?? 'unknown',
    candles: [...byTime.values()].sort((a, b) => a.time - b.time),
  };
}
