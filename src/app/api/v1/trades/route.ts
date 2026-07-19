/**
 * GET /api/v1/trades — representative `/api/v1` endpoint (Phase 11.2).
 *
 * Demonstrates the contract end-to-end WITHOUT any RLS bypass:
 *   • Rate limited BEFORE auth, so unauthenticated probing is throttled too.
 *   • Bearer token parsed + authorized against the required scope (fail closed).
 *   • Documented error envelope + version header on every response.
 *
 * THE API IS NOT A BYPASS: resolving a token to an RLS-scoped data read
 * requires minting a short-lived scoped session for the token's user via the
 * Supabase admin API, then calling the EXISTING journal service (never a
 * service-role query that skips RLS, never parallel logic). That live step is a
 * documented seam — until it's wired, this endpoint fails closed with 401 for
 * unauthenticated callers, which is the correct, verifiable behavior. It never
 * fabricates data.
 */
import { NextResponse } from 'next/server';
import { parseBearer } from '@/features/api/auth';
import { apiError, API_VERSION, statusFor } from '@/features/api/http';
import { apiRateLimitFor, rateLimitHeaders } from '@/features/api/rate-limit';
import { consumeRateLimit } from '@/features/api/rate-limit-store';
import { rateLimitSubject } from '@/features/api/request';

function withVersion(res: NextResponse): NextResponse {
  res.headers.set('X-API-Version', API_VERSION);
  return res;
}

function withHeaders(res: NextResponse, headers: Record<string, string>): NextResponse {
  for (const [key, value] of Object.entries(headers)) res.headers.set(key, value);
  return res;
}

export async function GET(req: Request): Promise<NextResponse> {
  const token = parseBearer(req.headers.get('authorization'));

  // Rate limit FIRST, keyed by token identity when present and by client IP
  // otherwise, so anonymous enumeration is throttled too. The token's plan tier
  // cannot be resolved until the token-store seam is wired, so the most
  // conservative (free) budget applies — fail closed, never fail generous.
  const decision = consumeRateLimit(rateLimitSubject(req, token), apiRateLimitFor('free'));
  const limitHeaders = rateLimitHeaders(decision);

  if (!decision.allowed) {
    return withHeaders(
      withVersion(
        NextResponse.json(
          apiError('rate_limited', 'Rate limit exceeded. Retry after the reset window.'),
          { status: statusFor('rate_limited') },
        ),
      ),
      limitHeaders,
    );
  }

  if (!token) {
    return withHeaders(
      withVersion(
        NextResponse.json(apiError('unauthorized', 'Missing or malformed API token.'), {
          status: 401,
        }),
      ),
      limitHeaders,
    );
  }

  // Token store + RLS-scoped session resolution is a flagged live seam (above).
  // Fail closed rather than bypass RLS or return fabricated data.
  return withHeaders(
    withVersion(
      NextResponse.json(
        apiError('unauthorized', 'API token resolution is not enabled in this environment.'),
        { status: 401 },
      ),
    ),
    limitHeaders,
  );
}
