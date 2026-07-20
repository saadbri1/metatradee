import { canonicalInstant, canonicalSerialize, type Sha256Hasher } from './canonical';
import { SOURCE_SCHEMAS, type CacheSourceIdentity, type TimeRange } from './types';

export interface UtcDaySegment extends TimeRange {
  bucketDate: string;
}

export interface CacheKeyIdentity extends CacheSourceIdentity, UtcDaySegment {}

export function normalizeRange(start: string, end: string): TimeRange {
  const normalized = {
    start: canonicalInstant(start, 'range start'),
    end: canonicalInstant(end, 'range end'),
  };
  if (Date.parse(normalized.start) >= Date.parse(normalized.end)) {
    throw new Error('Range must be a non-empty half-open interval.');
  }
  return normalized;
}

function utcDayStart(milliseconds: number): number {
  const date = new Date(milliseconds);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Split [start,end) at UTC midnight without inventing zero-length ranges. */
export function splitUtcDays(start: string, end: string): UtcDaySegment[] {
  const range = normalizeRange(start, end);
  const endMs = Date.parse(range.end);
  let cursor = Date.parse(range.start);
  const segments: UtcDaySegment[] = [];
  while (cursor < endMs) {
    const bucketStart = utcDayStart(cursor);
    const nextMidnight = bucketStart + 86_400_000;
    const segmentEnd = Math.min(nextMidnight, endMs);
    if (cursor < segmentEnd) {
      segments.push({
        bucketDate: new Date(bucketStart).toISOString().slice(0, 10),
        start: new Date(cursor).toISOString(),
        end: new Date(segmentEnd).toISOString(),
      });
    }
    cursor = segmentEnd;
  }
  return segments;
}

export function validateUtcDaySegment(segment: UtcDaySegment): UtcDaySegment {
  const normalized = normalizeRange(segment.start, segment.end);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(segment.bucketDate)) {
    throw new Error('bucketDate must use YYYY-MM-DD.');
  }
  const bucketStart = Date.parse(`${segment.bucketDate}T00:00:00.000Z`);
  const bucketEnd = bucketStart + 86_400_000;
  if (
    !Number.isFinite(bucketStart) ||
    new Date(bucketStart).toISOString().slice(0, 10) !== segment.bucketDate ||
    Date.parse(normalized.start) < bucketStart ||
    Date.parse(normalized.end) > bucketEnd
  ) {
    throw new Error('Cache segment must stay inside its UTC day bucket.');
  }
  return { bucketDate: segment.bucketDate, ...normalized };
}

export async function createCacheKey(
  identity: CacheKeyIdentity,
  hasher: Sha256Hasher,
): Promise<string> {
  const segment = validateUtcDaySegment(identity);
  if (!Number.isSafeInteger(identity.normalizationVersion) || identity.normalizationVersion < 1) {
    throw new Error('normalizationVersion must be a positive safe integer.');
  }
  if (!SOURCE_SCHEMAS.includes(identity.sourceSchema)) throw new Error('Invalid source schema.');
  for (const [label, value] of Object.entries({
    provider: identity.provider,
    dataset: identity.dataset,
    symbol: identity.symbol,
  })) {
    if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
      throw new Error(`${label} must be a non-empty canonical string.`);
    }
  }
  const canonical = canonicalSerialize({
    bucketDate: segment.bucketDate,
    dataset: identity.dataset,
    format: 1,
    normalizationVersion: identity.normalizationVersion,
    provider: identity.provider,
    segmentEnd: segment.end,
    segmentStart: segment.start,
    sourceSchema: identity.sourceSchema,
    symbol: identity.symbol,
  });
  const digest = await hasher.sha256Hex(canonical);
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('Invalid SHA-256 digest.');
  return digest;
}
