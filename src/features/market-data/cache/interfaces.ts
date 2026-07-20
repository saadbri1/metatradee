import type { Candle } from '@/features/chart/types';
import type { CacheRangeRequest, CandleCacheSegment, TimeRange } from './types';

export interface CandleCacheRepository {
  findSegments(request: CacheRangeRequest): Promise<readonly CandleCacheSegment[]>;
  saveSegment(segment: CandleCacheSegment): Promise<CandleCacheSegment>;
}

export interface CandleProviderResult {
  range: TimeRange;
  coverageKind: 'data' | 'empty';
  candles: readonly Candle[];
}

/** Vendor-neutral port. Concrete provider and authorization policy live outside this slice. */
export interface CandleProvider {
  fetchNormalizedCandles(request: CacheRangeRequest): Promise<CandleProviderResult>;
}
