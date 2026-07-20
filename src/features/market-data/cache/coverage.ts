import type { Candle } from '@/features/chart/types';
import { assertStrictCandles, canonicalInstant } from './canonical';
import { normalizeRange, validateUtcDaySegment } from './ranges';
import {
  SOURCE_SCHEMAS,
  type CacheRangeRequest,
  type CandleCacheSegment,
  type TimeRange,
} from './types';

export interface CoverageResult {
  state: 'complete' | 'incomplete';
  selectedSegments: readonly CandleCacheSegment[];
  excludedRevisionIds: readonly string[];
  coveredRanges: readonly TimeRange[];
  gaps: readonly TimeRange[];
}

function required(value: string, label: string): string {
  if (!value || value.trim() !== value)
    throw new Error(`${label} must be canonical and non-empty.`);
  return value;
}

function cloneCandles(candles: readonly Candle[]): readonly Candle[] {
  return Object.freeze(candles.map((candle) => Object.freeze({ ...candle })));
}

export function normalizeCacheSegment(segment: CandleCacheSegment): CandleCacheSegment {
  const range = normalizeRange(segment.rangeStart, segment.rangeEnd);
  validateUtcDaySegment({ bucketDate: segment.bucketDate, start: range.start, end: range.end });
  assertStrictCandles(segment.candles, true);
  if (!Number.isSafeInteger(segment.normalizationVersion) || segment.normalizationVersion < 1) {
    throw new Error('normalizationVersion must be a positive safe integer.');
  }
  if (!Number.isSafeInteger(segment.precedence) || segment.precedence < 0) {
    throw new Error('precedence must be a non-negative safe integer.');
  }
  if (!SOURCE_SCHEMAS.includes(segment.sourceSchema)) throw new Error('Invalid source schema.');
  if (segment.coverageKind !== 'data' && segment.coverageKind !== 'empty') {
    throw new Error('Invalid cache coverage kind.');
  }
  if (!/^[a-f0-9]{64}$/.test(segment.contentDigest)) throw new Error('Invalid content digest.');
  if (segment.coverageKind === 'data' && segment.candles.length === 0) {
    throw new Error('Data coverage must contain candles.');
  }
  if (segment.coverageKind === 'empty' && segment.candles.length !== 0) {
    throw new Error('Confirmed-empty coverage cannot contain candles.');
  }
  const rangeStartSeconds = Date.parse(range.start) / 1000;
  const rangeEndSeconds = Date.parse(range.end) / 1000;
  if (
    segment.candles.some(
      (candle) => candle.time < rangeStartSeconds || candle.time >= rangeEndSeconds,
    )
  ) {
    throw new Error('Segment candles must stay inside its half-open range.');
  }
  const fetchedAt = canonicalInstant(segment.fetchedAt, 'fetchedAt');
  const revalidateAt = canonicalInstant(segment.revalidateAt, 'revalidateAt');
  const expiresAt = canonicalInstant(segment.expiresAt, 'expiresAt');
  if (
    Date.parse(fetchedAt) > Date.parse(revalidateAt) ||
    Date.parse(revalidateAt) > Date.parse(expiresAt)
  ) {
    throw new Error('Segment freshness timestamps must be ordered.');
  }
  return Object.freeze({
    ...segment,
    provider: required(segment.provider, 'provider'),
    dataset: required(segment.dataset, 'dataset'),
    symbol: required(segment.symbol, 'symbol'),
    revisionId: required(segment.revisionId, 'revisionId'),
    rangeStart: range.start,
    rangeEnd: range.end,
    fetchedAt,
    revalidateAt,
    expiresAt,
    candles: cloneCandles(segment.candles),
  });
}

function sameIdentity(request: CacheRangeRequest, segment: CandleCacheSegment): boolean {
  return (
    request.provider === segment.provider &&
    request.dataset === segment.dataset &&
    request.symbol === segment.symbol &&
    request.sourceSchema === segment.sourceSchema &&
    request.normalizationVersion === segment.normalizationVersion
  );
}

function compareRevision(a: CandleCacheSegment, b: CandleCacheSegment): number {
  return (
    b.precedence - a.precedence ||
    Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt) ||
    (a.revisionId < b.revisionId ? -1 : a.revisionId > b.revisionId ? 1 : 0)
  );
}

function overlap(a: CandleCacheSegment, b: CandleCacheSegment): boolean {
  return (
    Date.parse(a.rangeStart) < Date.parse(b.rangeEnd) &&
    Date.parse(b.rangeStart) < Date.parse(a.rangeEnd)
  );
}

function mergeRanges(ranges: readonly TimeRange[]): TimeRange[] {
  const sorted = [...ranges].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const merged: TimeRange[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (!previous || Date.parse(range.start) > Date.parse(previous.end)) merged.push({ ...range });
    else if (Date.parse(range.end) > Date.parse(previous.end)) previous.end = range.end;
  }
  return merged;
}

export function calculateCoverage(
  request: CacheRangeRequest,
  segments: readonly CandleCacheSegment[],
  evaluationTime: string,
): CoverageResult {
  const requested = normalizeRange(request.rangeStart, request.rangeEnd);
  required(request.provider, 'provider');
  required(request.dataset, 'dataset');
  required(request.symbol, 'symbol');
  if (!SOURCE_SCHEMAS.includes(request.sourceSchema)) throw new Error('Invalid source schema.');
  if (!Number.isSafeInteger(request.normalizationVersion) || request.normalizationVersion < 1) {
    throw new Error('normalizationVersion must be a positive safe integer.');
  }
  const evaluatedAt = Date.parse(canonicalInstant(evaluationTime, 'evaluationTime'));
  const normalized = segments.map(normalizeCacheSegment);
  if (normalized.some((segment) => !sameIdentity(request, segment))) {
    throw new Error('Cache segment identity does not match the request.');
  }
  if (new Set(normalized.map((segment) => segment.revisionId)).size !== normalized.length) {
    throw new Error('Cache revision IDs must be unique.');
  }
  const excluded = new Set<string>();
  const fresh = normalized.filter((segment) => {
    if (
      Date.parse(segment.rangeStart) >= Date.parse(requested.end) ||
      Date.parse(segment.rangeEnd) <= Date.parse(requested.start)
    ) {
      return false;
    }
    const usable =
      evaluatedAt < Date.parse(segment.revalidateAt) && evaluatedAt < Date.parse(segment.expiresAt);
    if (!usable) excluded.add(segment.revisionId);
    return usable;
  });
  const groups = new Map<string, CandleCacheSegment[]>();
  for (const segment of fresh) {
    const key = `${segment.rangeStart}\u0000${segment.rangeEnd}`;
    const group = groups.get(key) ?? [];
    group.push(segment);
    groups.set(key, group);
  }
  const selected = [...groups.values()].map((group) => {
    const ordered = [...group].sort(compareRevision);
    ordered.slice(1).forEach((segment) => excluded.add(segment.revisionId));
    return ordered[0]!;
  });
  selected.sort(
    (a, b) => Date.parse(a.rangeStart) - Date.parse(b.rangeStart) || compareRevision(a, b),
  );
  for (let index = 0; index < selected.length; index += 1) {
    for (let other = index + 1; other < selected.length; other += 1) {
      const a = selected[index]!;
      const b = selected[other]!;
      if (overlap(a, b) && a.coverageKind !== b.coverageKind) {
        throw new Error('Overlapping data and confirmed-empty coverage is contradictory.');
      }
    }
  }
  const requestStart = Date.parse(requested.start);
  const requestEnd = Date.parse(requested.end);
  const clipped = selected
    .map((segment) => ({
      start: new Date(Math.max(requestStart, Date.parse(segment.rangeStart))).toISOString(),
      end: new Date(Math.min(requestEnd, Date.parse(segment.rangeEnd))).toISOString(),
    }))
    .filter((range) => Date.parse(range.start) < Date.parse(range.end));
  const coveredRanges = mergeRanges(clipped);
  const gaps: TimeRange[] = [];
  let cursor = requestStart;
  for (const range of coveredRanges) {
    const start = Date.parse(range.start);
    if (cursor < start) gaps.push({ start: new Date(cursor).toISOString(), end: range.start });
    cursor = Math.max(cursor, Date.parse(range.end));
  }
  if (cursor < requestEnd) gaps.push({ start: new Date(cursor).toISOString(), end: requested.end });
  return Object.freeze({
    state: gaps.length === 0 ? 'complete' : 'incomplete',
    selectedSegments: Object.freeze(selected),
    excludedRevisionIds: Object.freeze([...excluded].sort()),
    coveredRanges: Object.freeze(coveredRanges),
    gaps: Object.freeze(gaps),
  });
}
