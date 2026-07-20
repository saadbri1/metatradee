import type { Candle } from '@/features/chart/types';

export const SOURCE_SCHEMAS = ['ohlcv-1m', 'ohlcv-1h'] as const;
export type SourceSchema = (typeof SOURCE_SCHEMAS)[number];

export interface CacheSourceIdentity {
  provider: string;
  dataset: string;
  symbol: string;
  sourceSchema: SourceSchema;
  normalizationVersion: number;
}

export interface CacheRangeRequest extends CacheSourceIdentity {
  rangeStart: string;
  rangeEnd: string;
}

export type CacheCoverageKind = 'data' | 'empty';

/** One immutable normalized source-data revision. All time metadata is explicit. */
export interface CandleCacheSegment extends CacheSourceIdentity {
  revisionId: string;
  /** Higher values win when an exact range has multiple revisions. */
  precedence: number;
  bucketDate: string;
  rangeStart: string;
  rangeEnd: string;
  coverageKind: CacheCoverageKind;
  candles: readonly Candle[];
  contentDigest: string;
  fetchedAt: string;
  revalidateAt: string;
  expiresAt: string;
}

export interface TimeRange {
  start: string;
  end: string;
}
