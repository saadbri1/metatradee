import type { Candle } from '@/features/chart/types';
import { TIMEFRAME_SOURCE, toTimeframe, type Timeframe } from '../databento/aggregate';
import {
  assertStrictCandles,
  digestCandleContent,
  digestReplayWindow,
  type Sha256Hasher,
} from './canonical';
import { calculateCoverage, type CoverageResult } from './coverage';
import type { CacheRangeRequest, CandleCacheSegment } from './types';

export interface AssemblyRequest extends CacheRangeRequest {
  timeframe: Timeframe;
  replayEngineVersion: number;
  evaluationTime: string;
}

export interface CandleAssembly {
  sourceCandles: readonly Candle[];
  outputCandles: readonly Candle[];
  coverage: CoverageResult;
  sourceRevisionIds: readonly string[];
  replayDigest: string | null;
  rowCounts: { segmentRows: number; sourceRows: number; outputRows: number };
}

function candleEqual(a: Candle, b: Candle): boolean {
  return (
    a.time === b.time &&
    a.open === b.open &&
    a.high === b.high &&
    a.low === b.low &&
    a.close === b.close &&
    a.volume === b.volume
  );
}

function freezeCandles(candles: readonly Candle[]): readonly Candle[] {
  return Object.freeze(candles.map((candle) => Object.freeze({ ...candle })));
}

export async function assembleCandles(
  request: AssemblyRequest,
  segments: readonly CandleCacheSegment[],
  hasher: Sha256Hasher,
): Promise<CandleAssembly> {
  if (TIMEFRAME_SOURCE[request.timeframe].schema !== request.sourceSchema) {
    throw new Error('Requested timeframe does not match its native source schema.');
  }
  const coverage = calculateCoverage(request, segments, request.evaluationTime);
  for (const segment of coverage.selectedSegments) {
    if ((await digestCandleContent(segment.candles, hasher)) !== segment.contentDigest) {
      throw new Error(`Cache segment ${segment.revisionId} failed content verification.`);
    }
  }
  const allRows = coverage.selectedSegments
    .filter((segment) => segment.coverageKind === 'data')
    .flatMap((segment) => segment.candles.map((candle) => ({ ...candle })))
    .sort((a, b) => a.time - b.time);
  const merged: Candle[] = [];
  for (const candle of allRows) {
    const previous = merged.at(-1);
    if (previous?.time === candle.time) {
      if (!candleEqual(previous, candle)) throw new Error(`Conflicting candles at ${candle.time}.`);
      continue;
    }
    merged.push(candle);
  }
  const startSeconds = Date.parse(request.rangeStart) / 1000;
  const endSeconds = Date.parse(request.rangeEnd) / 1000;
  const sourceCandles = merged.filter(
    (candle) => candle.time >= startSeconds && candle.time < endSeconds,
  );
  assertStrictCandles(sourceCandles, true);
  const outputCandles = toTimeframe(sourceCandles, request.timeframe).filter(
    (candle) => candle.time >= startSeconds && candle.time < endSeconds,
  );
  assertStrictCandles(outputCandles, true);
  const replayDigest =
    coverage.state === 'complete'
      ? await digestReplayWindow(
          {
            provider: request.provider,
            dataset: request.dataset,
            symbol: request.symbol,
            timeframe: request.timeframe,
            sourceSchema: request.sourceSchema,
            rangeStart: request.rangeStart,
            rangeEnd: request.rangeEnd,
            normalizationVersion: request.normalizationVersion,
            replayEngineVersion: request.replayEngineVersion,
          },
          outputCandles,
          hasher,
        )
      : null;
  return Object.freeze({
    sourceCandles: freezeCandles(sourceCandles),
    outputCandles: freezeCandles(outputCandles),
    coverage,
    sourceRevisionIds: Object.freeze(
      coverage.selectedSegments.map((segment) => segment.revisionId),
    ),
    replayDigest,
    rowCounts: Object.freeze({
      segmentRows: allRows.length,
      sourceRows: sourceCandles.length,
      outputRows: outputCandles.length,
    }),
  });
}
