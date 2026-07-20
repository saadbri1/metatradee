/**
 * Canonical serialization and SHA-256 inputs for normalized candle data.
 *
 * This module deliberately does not choose Node crypto or Web Crypto. Callers
 * inject a SHA-256 implementation, keeping the domain usable in either runtime
 * and making the algorithm boundary explicit. No secret or provider payload is
 * accepted here: only replay identity metadata and vendor-free Candle values.
 */
import type { Candle } from '@/features/chart/types';
import { TIMEFRAMES, type Timeframe } from '../databento/aggregate';
import { SOURCE_SCHEMAS, type SourceSchema } from './types';

export interface Sha256Hasher {
  sha256Hex(value: string): string | Promise<string>;
}

export type CanonicalValue =
  | null
  | boolean
  | string
  | number
  | readonly CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

export class CanonicalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanonicalizationError';
  }
}

/** Stable JSON-like encoding: sorted object keys and locale-independent numbers. */
export function canonicalSerialize(value: CanonicalValue): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new CanonicalizationError('Canonical numbers must be finite.');
    }
    // JSON treats -0 and 0 identically; make that semantic choice explicit.
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalSerialize(item)).join(',')}]`;
  }
  const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalSerialize(item)}`)
    .join(',')}}`;
}

export function canonicalInstant(value: string, label = 'timestamp'): string {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) {
    throw new CanonicalizationError(`${label} must be a non-empty ISO 8601 timestamp.`);
  }
  // Require an explicit zone. Date.parse otherwise interprets a local time.
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw new CanonicalizationError(`${label} must include an explicit UTC offset.`);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new CanonicalizationError(`${label} must be a valid ISO 8601 timestamp.`);
  }
  return new Date(milliseconds).toISOString();
}

export function assertStrictCandles(candles: readonly Candle[], allowEmpty = false): void {
  if (!allowEmpty && candles.length === 0) {
    throw new CanonicalizationError('At least one candle is required.');
  }
  let previous = -Infinity;
  for (const [index, candle] of candles.entries()) {
    const values = [candle.time, candle.open, candle.high, candle.low, candle.close, candle.volume];
    if (values.some((number) => !Number.isFinite(number))) {
      throw new CanonicalizationError(`Candle ${index} contains a non-finite number.`);
    }
    if (!Number.isInteger(candle.time) || candle.time <= 0) {
      throw new CanonicalizationError(`Candle ${index} time must be a positive integer second.`);
    }
    if (candle.time <= previous) {
      throw new CanonicalizationError('Candle timestamps must be strictly increasing and unique.');
    }
    if (
      candle.volume < 0 ||
      candle.low > candle.high ||
      candle.open < candle.low ||
      candle.open > candle.high ||
      candle.close < candle.low ||
      candle.close > candle.high
    ) {
      throw new CanonicalizationError(`Candle ${index} is not a valid normalized OHLCV bar.`);
    }
    previous = candle.time;
  }
}

function candleTuples(candles: readonly Candle[]): CanonicalValue[] {
  return candles.map((candle) => [
    candle.time,
    candle.open,
    candle.high,
    candle.low,
    candle.close,
    candle.volume,
  ]);
}

async function digestCanonical(value: CanonicalValue, hasher: Sha256Hasher): Promise<string> {
  const digest = await hasher.sha256Hex(canonicalSerialize(value));
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new CanonicalizationError('SHA-256 implementations must return 64 lowercase hex chars.');
  }
  return digest;
}

/** Content-only digest used to verify immutable cache segment payloads. */
export async function digestCandleContent(
  candles: readonly Candle[],
  hasher: Sha256Hasher,
): Promise<string> {
  assertStrictCandles(candles, true);
  return digestCanonical({ candles: candleTuples(candles), format: 1 }, hasher);
}

export interface ReplayWindowIdentity {
  provider: string;
  dataset: string;
  symbol: string;
  timeframe: Timeframe;
  sourceSchema: SourceSchema;
  rangeStart: string;
  rangeEnd: string;
  normalizationVersion: number;
  replayEngineVersion: number;
}

function positiveVersion(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new CanonicalizationError(`${label} must be a positive safe integer.`);
  }
  return value;
}

function requiredIdentity(value: string, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new CanonicalizationError(`${label} must be a non-empty canonical string.`);
  }
  return value;
}

/** Canonical digest for an exact replay identity plus its ordered output bars. */
export async function digestReplayWindow(
  identity: ReplayWindowIdentity,
  candles: readonly Candle[],
  hasher: Sha256Hasher,
): Promise<string> {
  assertStrictCandles(candles, true);
  const rangeStart = canonicalInstant(identity.rangeStart, 'rangeStart');
  const rangeEnd = canonicalInstant(identity.rangeEnd, 'rangeEnd');
  if (!TIMEFRAMES.includes(identity.timeframe) || !SOURCE_SCHEMAS.includes(identity.sourceSchema)) {
    throw new CanonicalizationError('Replay timeframe or source schema is invalid.');
  }
  if (Date.parse(rangeStart) >= Date.parse(rangeEnd)) {
    throw new CanonicalizationError('Replay range must be a non-empty half-open interval.');
  }
  const rangeStartSeconds = Date.parse(rangeStart) / 1000;
  const rangeEndSeconds = Date.parse(rangeEnd) / 1000;
  if (candles.some((candle) => candle.time < rangeStartSeconds || candle.time >= rangeEndSeconds)) {
    throw new CanonicalizationError('Replay candles must stay inside the half-open range.');
  }
  return digestCanonical(
    {
      candles: candleTuples(candles),
      dataset: requiredIdentity(identity.dataset, 'dataset'),
      format: 1,
      normalizationVersion: positiveVersion(identity.normalizationVersion, 'normalizationVersion'),
      provider: requiredIdentity(identity.provider, 'provider'),
      rangeEnd,
      rangeStart,
      replayEngineVersion: positiveVersion(identity.replayEngineVersion, 'replayEngineVersion'),
      sourceSchema: identity.sourceSchema,
      symbol: requiredIdentity(identity.symbol, 'symbol'),
      timeframe: identity.timeframe,
    },
    hasher,
  );
}
