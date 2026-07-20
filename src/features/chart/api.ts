/**
 * Browser → MetaTradee candles API.
 *
 * The browser NEVER talks to Databento. It calls our own authenticated route,
 * which holds the provider key server-side. This module knows only our stable
 * response envelope and our stable error codes — no vendor shapes leak here.
 *
 * There is deliberately NO fallback: if the request fails, the UI shows the
 * failure. Substituting fixture or synthetic candles would put invented prices
 * on a chart a trader might act on, which is the one outcome this whole feature
 * must never produce.
 */
import type { Candle } from './types';
import type { Timeframe } from '@/features/market-data/databento/aggregate';

export const CANDLES_ENDPOINT = '/api/market-data/candles';

/** The documented success envelope. */
export interface CandleResponse {
  symbol: string;
  timeframe: string;
  start: string;
  end: string;
  provider: string;
  candles: Candle[];
}

/**
 * Stable UI error codes. The first nine mirror the API's application codes; the
 * last two cover conditions the API cannot report about itself.
 */
export type ChartErrorCode =
  | 'market_data_not_configured'
  | 'validation_failed'
  | 'market_data_timeout'
  | 'request_cancelled'
  | 'market_data_unavailable'
  | 'market_data_rate_limited'
  | 'no_market_data'
  | 'internal'
  | 'unauthenticated'
  | 'network'
  | 'unexpected';

export class ChartRequestError extends Error {
  readonly code: ChartErrorCode;
  /** Server-supplied detail, safe to show — the API guarantees it is sanitized. */
  readonly detail: string | undefined;
  constructor(code: ChartErrorCode, detail?: string) {
    super(code);
    this.name = 'ChartRequestError';
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Headline copy per state. Kept here so the UI cannot invent a reassuring
 * message for a failure that actually happened.
 */
export const CHART_ERROR_COPY: Record<ChartErrorCode, { title: string; hint: string }> = {
  market_data_not_configured: {
    title: 'Market data is not configured',
    hint: 'This environment has no market-data provider connected, so no candles can be loaded.',
  },
  validation_failed: {
    title: 'Check the request',
    hint: 'One of the values above was rejected.',
  },
  market_data_timeout: {
    title: 'The request timed out',
    hint: 'The provider took too long. Try a shorter range.',
  },
  request_cancelled: {
    title: 'Request cancelled',
    hint: 'The request was stopped before it finished.',
  },
  market_data_unavailable: {
    title: 'Market data is unavailable',
    hint: 'The provider could not be reached. This is usually temporary.',
  },
  market_data_rate_limited: {
    title: 'Rate limit reached',
    hint: 'Too many market-data requests. Wait a moment and try again.',
  },
  no_market_data: {
    title: 'No candles for that range',
    hint: 'The contract and range are valid but returned no data. Markets may have been closed.',
  },
  internal: {
    title: 'Something went wrong',
    hint: 'The request could not be completed.',
  },
  unauthenticated: {
    title: 'Your session has expired',
    hint: 'Sign in again to load market data.',
  },
  network: {
    title: 'Connection problem',
    hint: 'The request could not reach MetaTradee. Check your connection.',
  },
  unexpected: {
    title: 'Unexpected response',
    hint: 'The server returned something this page could not read.',
  },
};

export interface CandleRequest {
  symbol: string;
  timeframe: Timeframe;
  /** ISO 8601 UTC, e.g. 2022-06-06T20:50:00Z. */
  start: string;
  end: string;
}

/** Codes the API is allowed to return. Anything else is treated as unexpected. */
const KNOWN_CODES = new Set<string>([
  'market_data_not_configured',
  'validation_failed',
  'market_data_timeout',
  'request_cancelled',
  'market_data_unavailable',
  'market_data_rate_limited',
  'no_market_data',
  'internal',
]);

function isCandle(value: unknown): value is Candle {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.time === 'number' &&
    typeof c.open === 'number' &&
    typeof c.high === 'number' &&
    typeof c.low === 'number' &&
    typeof c.close === 'number' &&
    typeof c.volume === 'number'
  );
}

/**
 * Load candles. Rejects with `ChartRequestError` on any failure, or rethrows an
 * `AbortError` unchanged so callers can tell "we cancelled this" from "this
 * failed" — a cancelled request must never render as an error.
 */
export async function loadCandles(
  request: CandleRequest,
  signal?: AbortSignal,
): Promise<CandleResponse> {
  const url = `${CANDLES_ENDPOINT}?${new URLSearchParams({
    symbol: request.symbol,
    timeframe: request.timeframe,
    start: request.start,
    end: request.end,
  })}`;

  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch (error) {
    // A caller-initiated abort is not a failure — let it propagate untouched.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ChartRequestError('network');
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ChartRequestError('unexpected');
  }

  if (!response.ok) {
    if (response.status === 401) throw new ChartRequestError('unauthenticated');
    const error = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error;
    const code =
      typeof error?.code === 'string' && KNOWN_CODES.has(error.code) ? error.code : 'unexpected';
    const detail = typeof error?.message === 'string' ? error.message : undefined;
    throw new ChartRequestError(code as ChartErrorCode, detail);
  }

  const data = (body as { data?: unknown } | null)?.data;
  if (typeof data !== 'object' || data === null) throw new ChartRequestError('unexpected');
  const payload = data as Record<string, unknown>;
  if (!Array.isArray(payload.candles) || !payload.candles.every(isCandle)) {
    throw new ChartRequestError('unexpected');
  }

  return {
    symbol: String(payload.symbol ?? request.symbol),
    timeframe: String(payload.timeframe ?? request.timeframe),
    start: String(payload.start ?? request.start),
    end: String(payload.end ?? request.end),
    provider: String(payload.provider ?? 'unknown'),
    candles: payload.candles as Candle[],
  };
}
