/**
 * GET /api/market-data/candles — authenticated historical candles.
 *
 * This is an APP endpoint (Supabase session cookie), not part of the public
 * `/api/v1` token API, so it deliberately does not carry the `X-API-Version`
 * header — that header is a versioning promise `/api/v1` makes and this route
 * does not. It reuses `apiError()` so there is exactly ONE error envelope in the
 * codebase rather than a second parallel shape.
 *
 * AUTH: `requireAuth()` is NOT used here. It redirects to the login page, which
 * is correct for a page and wrong for a fetch caller — a 307 to HTML would
 * surface as an unparseable success. This route resolves the user itself and
 * returns a 401 JSON envelope, failing closed before any provider call.
 *
 * COST: every authorized request is a billed provider call. Auth runs first,
 * then validation, and only then the client — so neither an anonymous caller
 * nor a malformed range can spend money. There is no caching by design; caching
 * is a separate, unapproved decision.
 */
import { NextResponse } from 'next/server';
import { apiError } from '@/features/api/http';
import { getAuthenticatedUser } from '@/features/auth/server/session';
import { fetchCandles, MarketDataError } from '@/features/market-data/databento/client';
import { candleQuerySchema, providerLimitFor } from '@/features/market-data/request';

/** Authenticated + billed: never statically rendered or cached. */
export const dynamic = 'force-dynamic';

/**
 * Provider failure → public response. Each entry is a STABLE application code
 * plus a message written to be safe to display: no key, no Authorization
 * header, no provider body or HTML, no upstream URL, no stack, no SDK internals.
 *
 * Provider-credential failures deliberately surface as 502, never 401: a 401
 * would tell the caller *their* session was rejected when in fact our server
 * configuration is at fault.
 */
const PROVIDER_FAILURES = {
  not_configured: {
    status: 503,
    code: 'market_data_not_configured',
    message: 'Market data is not available in this environment.',
    retryable: false,
  },
  invalid_symbol: {
    status: 422,
    code: 'validation_failed',
    message: 'Symbol must be a dated futures contract for ES, MES, NQ or MNQ.',
    retryable: false,
  },
  timeout: {
    status: 504,
    code: 'market_data_timeout',
    message: 'The market data request timed out. Try a smaller range.',
    retryable: true,
  },
  aborted: {
    // The caller has usually disconnected, so this body is rarely observed; it
    // still must not read as a server fault.
    status: 503,
    code: 'request_cancelled',
    message: 'The market data request was cancelled.',
    retryable: false,
  },
  auth: {
    status: 502,
    code: 'market_data_unavailable',
    message: 'Market data is temporarily unavailable.',
    retryable: false,
  },
  rate_limit: {
    status: 429,
    code: 'market_data_rate_limited',
    message: 'Market data rate limit reached. Try again shortly.',
    retryable: true,
  },
  provider_unavailable: {
    status: 502,
    code: 'market_data_unavailable',
    message: 'Market data is temporarily unavailable.',
    retryable: true,
  },
  invalid_response: {
    status: 502,
    code: 'market_data_unavailable',
    message: 'Market data could not be read.',
    retryable: true,
  },
  empty_response: {
    status: 404,
    code: 'no_market_data',
    message: 'No candles are available for that contract and range.',
    retryable: false,
  },
} as const;

/**
 * Build the shared error envelope, optionally carrying a `retryable` hint so a
 * client can distinguish "back off and try again" from "this will never work".
 */
function fail(status: number, code: string, message: string, retryable?: boolean): NextResponse {
  const base = apiError(code, message);
  const body = retryable === undefined ? base : { ...base, error: { ...base.error, retryable } };
  return NextResponse.json(body, { status });
}

export async function GET(req: Request): Promise<NextResponse> {
  // 1. Auth first — fail closed. Nothing below runs for an anonymous caller.
  const user = await getAuthenticatedUser();
  if (!user) {
    return fail(401, 'unauthorized', 'Authentication is required.');
  }

  // 2. Validate. `.strict()` means an unknown query parameter is an error.
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = candleQuerySchema.safeParse(params);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(422, 'validation_failed', issue?.message ?? 'Invalid market data request.', false);
  }
  const query = parsed.data;

  // 3. Only now does a billed provider call happen.
  try {
    const result = await fetchCandles({
      symbol: query.symbol,
      timeframe: query.timeframe,
      start: query.start,
      end: query.end,
      limit: providerLimitFor(query),
      signal: req.signal,
    });

    return NextResponse.json({
      data: {
        symbol: result.symbol,
        timeframe: result.timeframe,
        start: query.start,
        end: query.end,
        provider: 'databento',
        candles: result.candles,
      },
    });
  } catch (error) {
    if (error instanceof MarketDataError) {
      const mapped = PROVIDER_FAILURES[error.code];
      return fail(mapped.status, mapped.code, mapped.message, mapped.retryable);
    }
    // Unknown failure: say nothing about it. The original error is not attached,
    // logged, or serialized — it may carry request or provider context.
    return fail(500, 'internal', 'Market data could not be loaded.');
  }
}
