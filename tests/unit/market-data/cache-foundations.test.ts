import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Candle } from '@/features/chart/types';
import {
  assembleCandles,
  calculateCoverage,
  canonicalSerialize,
  createCacheKey,
  digestCandleContent,
  digestReplayWindow,
  splitUtcDays,
  type CandleCacheSegment,
  type Sha256Hasher,
} from '@/features/market-data/cache';

const hasher: Sha256Hasher = {
  sha256Hex: (value) => createHash('sha256').update(value).digest('hex'),
};

function candle(time: number, close = 101): Candle {
  return { time, open: 100, high: Math.max(102, close), low: 99, close, volume: 10 };
}

async function segment(
  revisionId: string,
  start: string,
  end: string,
  candles: readonly Candle[],
  coverageKind: 'data' | 'empty' = candles.length ? 'data' : 'empty',
  precedence = 0,
): Promise<CandleCacheSegment> {
  return {
    provider: 'provider',
    dataset: 'dataset',
    symbol: 'ES',
    sourceSchema: 'ohlcv-1m',
    normalizationVersion: 1,
    revisionId,
    precedence,
    bucketDate: start.slice(0, 10),
    rangeStart: start,
    rangeEnd: end,
    coverageKind,
    candles,
    contentDigest: await digestCandleContent(candles, hasher),
    fetchedAt: '2025-01-02T00:00:00.000Z',
    revalidateAt: '2025-02-01T00:00:00.000Z',
    expiresAt: '2025-03-01T00:00:00.000Z',
  };
}

describe('canonical candle-cache foundations', () => {
  it('serializes object keys canonically while preserving candle order', async () => {
    expect(canonicalSerialize({ z: 1, a: { y: 2, x: 3 } })).toBe('{"a":{"x":3,"y":2},"z":1}');
    const identity = {
      provider: 'provider',
      dataset: 'dataset',
      symbol: 'ES',
      timeframe: '1m' as const,
      sourceSchema: 'ohlcv-1m' as const,
      rangeStart: '2025-01-01T00:00:00Z',
      rangeEnd: '2025-01-01T00:02:00Z',
      normalizationVersion: 1,
      replayEngineVersion: 1,
    };
    const bars = [candle(1_735_689_600), candle(1_735_689_660, 102)];
    const digest = await digestReplayWindow(identity, bars, hasher);
    expect(
      await digestReplayWindow(
        { ...identity },
        bars.map((bar) => ({ ...bar })),
        hasher,
      ),
    ).toBe(digest);
    await expect(digestReplayWindow(identity, [...bars].reverse(), hasher)).rejects.toThrow(
      'strictly increasing',
    );
    await expect(
      digestReplayWindow(identity, [{ ...bars[0]!, close: Number.NaN }, bars[1]!], hasher),
    ).rejects.toThrow('non-finite');
  });

  it('splits half-open ranges across month and year boundaries', async () => {
    expect(splitUtcDays('2024-12-31T23:59:00-00:00', '2025-01-02T00:01:00Z')).toEqual([
      {
        bucketDate: '2024-12-31',
        start: '2024-12-31T23:59:00.000Z',
        end: '2025-01-01T00:00:00.000Z',
      },
      {
        bucketDate: '2025-01-01',
        start: '2025-01-01T00:00:00.000Z',
        end: '2025-01-02T00:00:00.000Z',
      },
      {
        bucketDate: '2025-01-02',
        start: '2025-01-02T00:00:00.000Z',
        end: '2025-01-02T00:01:00.000Z',
      },
    ]);
    const keyInput = {
      provider: 'provider',
      dataset: 'dataset',
      symbol: 'ES',
      sourceSchema: 'ohlcv-1m' as const,
      normalizationVersion: 1,
      bucketDate: '2025-01-01',
      start: '2025-01-01T00:00:00Z',
      end: '2025-01-01T01:00:00Z',
    };
    expect(await createCacheKey(keyInput, hasher)).toMatch(/^[a-f0-9]{64}$/);
    expect(await createCacheKey({ ...keyInput }, hasher)).toBe(
      await createCacheKey(keyInput, hasher),
    );
  });

  it('calculates exact mixed coverage, gaps, revision precedence, and freshness', async () => {
    const a = await segment(
      'old',
      '2025-01-01T00:00:00Z',
      '2025-01-01T00:02:00Z',
      [candle(1_735_689_600)],
      'data',
      0,
    );
    const replacement = await segment('new', a.rangeStart, a.rangeEnd, a.candles, 'data', 1);
    const empty = await segment('empty', '2025-01-01T00:02:00Z', '2025-01-01T00:04:00Z', []);
    const request = {
      provider: 'provider',
      dataset: 'dataset',
      symbol: 'ES',
      sourceSchema: 'ohlcv-1m' as const,
      normalizationVersion: 1,
      rangeStart: '2025-01-01T00:00:00Z',
      rangeEnd: '2025-01-01T00:05:00Z',
    };
    const incomplete = calculateCoverage(request, [a, replacement, empty], '2025-01-15T00:00:00Z');
    expect(incomplete.state).toBe('incomplete');
    expect(incomplete.selectedSegments.map((item) => item.revisionId)).toEqual(['new', 'empty']);
    expect(incomplete.excludedRevisionIds).toEqual(['old']);
    expect(incomplete.gaps).toEqual([
      { start: '2025-01-01T00:04:00.000Z', end: '2025-01-01T00:05:00.000Z' },
    ]);
    const stale = calculateCoverage(request, [replacement, empty], '2025-02-01T00:00:00Z');
    expect(stale.gaps).toEqual([
      { start: '2025-01-01T00:00:00.000Z', end: '2025-01-01T00:05:00.000Z' },
    ]);
  });

  it('assembles partial ranges, exact-dedupes, derives 5m, and rejects conflicts', async () => {
    const bars = Array.from({ length: 5 }, (_, index) =>
      candle(1_735_689_600 + index * 60, 101 + index),
    );
    const left = await segment(
      'left',
      '2025-01-01T00:00:00Z',
      '2025-01-01T00:03:00Z',
      bars.slice(0, 3),
    );
    const right = await segment(
      'right',
      '2025-01-01T00:02:00Z',
      '2025-01-01T00:05:00Z',
      bars.slice(2),
    );
    const request = {
      provider: 'provider',
      dataset: 'dataset',
      symbol: 'ES',
      sourceSchema: 'ohlcv-1m' as const,
      normalizationVersion: 1,
      rangeStart: '2025-01-01T00:00:00Z',
      rangeEnd: '2025-01-01T00:05:00Z',
      timeframe: '5m' as const,
      replayEngineVersion: 1,
      evaluationTime: '2025-01-15T00:00:00Z',
    };
    const assembled = await assembleCandles(request, [right, left], hasher);
    expect(assembled.coverage.state).toBe('complete');
    expect(assembled.sourceCandles).toHaveLength(5);
    expect(assembled.outputCandles).toEqual([
      { time: bars[0]!.time, open: 100, high: 105, low: 99, close: 105, volume: 50 },
    ]);
    expect(assembled.replayDigest).toMatch(/^[a-f0-9]{64}$/);
    const conflicting = await segment(
      'conflict',
      right.rangeStart,
      right.rangeEnd,
      [{ ...bars[2]!, volume: 99 }, ...bars.slice(3)],
      'data',
      1,
    );
    await expect(assembleCandles(request, [left, right, conflicting], hasher)).rejects.toThrow(
      'Conflicting candles',
    );
  });
});
