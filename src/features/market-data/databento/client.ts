/**
 * Server-only Databento historical candle client.
 *
 * This is the ONLY module that talks to the market-data provider. Everything
 * above it receives vendor-free `Candle` values (src/features/chart/types.ts),
 * so the provider can be swapped without touching domain code — the same
 * boundary rule `price-chart.tsx` applies to the charting vendor
 * (docs/PROJECT_STRUCTURE.md rule 5).
 *
 * SECRET HANDLING: `DATABENTO_API_KEY` is read lazily, only when a request
 * actually executes, and travels solely in the `Authorization` header. It is
 * never placed in a URL, never logged, and never included in any thrown error.
 * `import 'server-only'` makes a client-bundle import a build error.
 *
 * COST: every call is a billed provider request. There is no caching here by
 * design — caching is a separate, unapproved decision.
 *
 * The request contract below was verified against a real authenticated response
 * (see docs/CHART_AND_BACKTESTING_DESIGN.md); the notes marked LIVE-VERIFIED
 * record shapes observed in that response rather than assumed from docs.
 */
import 'server-only';
import { serverEnv } from '@/config/env';
import type { Candle } from '@/features/chart/types';
import { parseDatedContract } from './symbols';
import { normalizeRows, type RawOhlcvRow } from './normalize';
import { TIMEFRAME_SOURCE, toTimeframe, type Timeframe } from './aggregate';

const ENDPOINT = 'https://hist.databento.com/v0/timeseries.get_range';

/** CME Globex MDP 3.0 — the only dataset approved for this milestone. */
const DATASET = 'GLBX.MDP3';

/** Conservative wall-clock budget for one provider call. */
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Conservative provider-side row cap. Bounds both cost and memory even if a
 * caller slips a wide range through: the provider stops sending at this count.
 */
const DEFAULT_ROW_LIMIT = 5_000;
const MAX_ROW_LIMIT = 10_000;

export type MarketDataErrorCode =
  | 'not_configured'
  | 'invalid_symbol'
  | 'timeout'
  | 'aborted'
  | 'auth'
  | 'rate_limit'
  | 'provider_unavailable'
  | 'invalid_response'
  | 'empty_response';

/**
 * Normalized market-data failure. Callers branch on `.code`, never on provider
 * payloads. Messages are written to be safe to surface: they contain no key, no
 * Authorization header, no raw provider body, and no stack detail.
 */
export class MarketDataError extends Error {
  readonly code: MarketDataErrorCode;
  readonly retryable: boolean;
  constructor(code: MarketDataErrorCode, message: string, retryable = false) {
    super(message);
    this.name = 'MarketDataError';
    this.code = code;
    this.retryable = retryable;
  }
}

export interface FetchCandlesOptions {
  /** Dated contract, e.g. `ESZ5`. Parent and continuous symbols are rejected. */
  symbol: string;
  timeframe: Timeframe;
  /** Inclusive start, ISO 8601 UTC. */
  start: string;
  /** Exclusive end, ISO 8601 UTC. */
  end: string;
  /** Provider-side row cap. Clamped to [1, MAX_ROW_LIMIT]. */
  limit?: number;
  timeoutMs?: number;
  /** Caller cancellation (e.g. the request was dropped). */
  signal?: AbortSignal;
}

export interface CandleFetchResult {
  symbol: string;
  timeframe: Timeframe;
  /** Provider schema actually requested (5m/15m are derived from 1m). */
  schema: 'ohlcv-1m' | 'ohlcv-1h';
  /** Rows received from the provider, before normalization. */
  rowsReceived: number;
  /** Rows rejected as malformed or structurally impossible. */
  rowsRejected: number;
  candles: Candle[];
}

/**
 * Split a JSON Lines body into plain objects.
 *
 * LIVE-VERIFIED: the provider returns `Content-Type: application/jsonl` with one
 * record per line. HTTP-level `Content-Encoding: gzip` is decoded by the fetch
 * runtime before we see the body — that is separate from the `compression`
 * request parameter, which we set to `none`.
 *
 * Blank lines are skipped (trailing newlines are normal). Anything that is not
 * parseable, or is not a plain object, fails the whole response rather than
 * being silently dropped: a partially-understood price feed is not trustworthy.
 */
function parseJsonLines(body: string): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    let value: unknown;
    try {
      value = JSON.parse(trimmed);
    } catch {
      // Deliberately does NOT echo the line — it is provider payload.
      throw new MarketDataError(
        'invalid_response',
        'Market data provider returned malformed data.',
      );
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new MarketDataError(
        'invalid_response',
        'Market data provider returned an unexpected record shape.',
      );
    }
    rows.push(value as Record<string, unknown>);
  }
  return rows;
}

/**
 * Flatten one provider record into the shape `normalizeRows()` expects.
 *
 * LIVE-VERIFIED: in an OHLCV JSON response the record's top-level keys are
 * `hd, open, high, low, close, volume`, and the timestamp lives at
 * `hd.ts_event` — NOT at the top level. Passing records through unflattened
 * would make every bar look malformed and yield an empty series. The top-level
 * fallback is kept because it costs nothing and covers schemas that do expose
 * `ts_event` directly.
 *
 * Only the six fields normalization needs are copied; the provider object is
 * read but never mutated.
 */
function flattenOhlcvRow(row: Record<string, unknown>): RawOhlcvRow {
  const hd = row.hd;
  const nested =
    typeof hd === 'object' && hd !== null && !Array.isArray(hd)
      ? (hd as Record<string, unknown>).ts_event
      : undefined;
  return {
    ts_event: nested ?? row.ts_event,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
  };
}

/** Map a non-OK provider status onto a normalized error. Body is never echoed. */
function errorForStatus(status: number): MarketDataError {
  if (status === 401 || status === 403) {
    return new MarketDataError('auth', 'Market data provider rejected the credentials.');
  }
  if (status === 429) {
    return new MarketDataError('rate_limit', 'Market data provider rate limit reached.', true);
  }
  if (status >= 500) {
    return new MarketDataError(
      'provider_unavailable',
      `Market data provider is unavailable (status ${status}).`,
      true,
    );
  }
  return new MarketDataError(
    'provider_unavailable',
    `Market data request was not accepted (status ${status}).`,
  );
}

/**
 * Fetch historical candles for one dated contract.
 *
 * One symbol, one request, no retries. 1m and 1h are fetched natively; 5m and
 * 15m are fetched as 1m and aggregated deterministically by `toTimeframe()`.
 */
export async function fetchCandles(options: FetchCandlesOptions): Promise<CandleFetchResult> {
  const { symbol, timeframe, start, end, signal } = options;

  const contract = parseDatedContract(symbol);
  if (!contract) {
    throw new MarketDataError(
      'invalid_symbol',
      'Symbol must be an approved dated futures contract, for example ESZ5.',
    );
  }

  const source = TIMEFRAME_SOURCE[timeframe];
  if (!source) {
    throw new MarketDataError('invalid_symbol', 'Unsupported timeframe.');
  }

  // Read the key as late as possible so an unconfigured deployment fails here
  // rather than at import time — the feature is disabled, not the whole app.
  const apiKey = serverEnv().DATABENTO_API_KEY;
  if (!apiKey) {
    throw new MarketDataError('not_configured', 'Market data provider is not configured.');
  }

  if (signal?.aborted) {
    throw new MarketDataError('aborted', 'Market data request was cancelled.');
  }

  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_ROW_LIMIT, MAX_ROW_LIMIT));

  const body = new URLSearchParams({
    dataset: DATASET,
    symbols: contract.symbol,
    schema: source.schema,
    stype_in: 'raw_symbol',
    start,
    end,
    encoding: 'json',
    compression: 'none',
    // Raw fixed-point integers and raw nanosecond timestamps: normalize.ts owns
    // both conversions, so the provider must not pre-format them.
    pretty_px: 'false',
    pretty_ts: 'false',
    limit: String(limit),
  });

  // Own controller so a caller signal and our timeout can be told apart.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener('abort', onCallerAbort, { once: true });

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        // HTTP Basic: API key as username, empty password. Header only — the
        // key must never reach a URL, a log line, or an error message.
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/jsonl',
      },
      body: body.toString(),
      signal: controller.signal,
      // Provider data is billed and point-in-time; never serve it from a cache
      // we did not design.
      cache: 'no-store',
    });
  } catch {
    if (timedOut) {
      throw new MarketDataError('timeout', 'Market data request timed out.', true);
    }
    if (signal?.aborted) {
      throw new MarketDataError('aborted', 'Market data request was cancelled.');
    }
    // The thrown cause is deliberately NOT bound or attached: fetch failures can
    // carry provider hostnames, proxy detail, and request context that must not
    // travel outward with the error.
    throw new MarketDataError('provider_unavailable', 'Market data provider is unreachable.', true);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }

  if (!response.ok) {
    throw errorForStatus(response.status);
  }

  const text = await response.text();
  const rawRows = parseJsonLines(text);
  if (rawRows.length === 0) {
    throw new MarketDataError(
      'empty_response',
      'No market data was returned for that contract and range.',
    );
  }

  const normalized = normalizeRows(rawRows.map(flattenOhlcvRow));
  if (normalized.length === 0) {
    throw new MarketDataError(
      'invalid_response',
      'Market data provider returned no usable candles.',
    );
  }

  return {
    symbol: contract.symbol,
    timeframe,
    schema: source.schema,
    rowsReceived: rawRows.length,
    rowsRejected: rawRows.length - normalized.length,
    candles: toTimeframe(normalized, timeframe),
  };
}
