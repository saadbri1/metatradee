/**
 * GET /api/integrations/ibkr/flex/connection-check
 *
 * Phase 1 diagnostic: proves MetaTradee can generate, retrieve and parse the
 * saved "MetaTradee Activity" IBKR Flex query. It imports nothing, persists
 * nothing, and changes no user data.
 *
 * AUTH: authenticated callers only, resolved here and failing closed with a
 * JSON 401 — the same approach as `/api/market-data/candles`, and for the same
 * reason: `requireAuth()` redirects, which is right for a page and wrong for a
 * fetch caller.
 *
 * NOT AVAILABLE IN PRODUCTION: the route 404s when `VERCEL_ENV` is
 * `production`, so merging this branch cannot expose a broker probe on the live
 * site while the credentials are still a shared Preview test account.
 *
 * NO ROUTE-LEVEL COOLDOWN. An earlier version threw its own local throttle and
 * labelled it `pacing_limit`, which was wrong twice over: it conflated our
 * cooldown with IBKR's, and it hid the real problem — that every refresh was
 * generating a new report. Refresh protection now lives where it belongs, in
 * the per-token session: a refresh inside the backoff window is answered from
 * stored state and makes no IBKR request at all.
 *
 * RESPONSE SAFETY: the body is built field-by-field in `checkFlexConnection`.
 * No raw IBKR XML, token, query id, full account number, provider message or
 * stack trace can appear in it.
 */
import { NextResponse } from 'next/server';
import { apiError } from '@/features/api/http';
import { getAuthenticatedUser } from '@/features/auth/server/session';
import { checkFlexConnection } from '@/features/integrations/ibkr/connection-check';

/** Credentialed and environment-dependent: never statically rendered. */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json(apiError('not_found', 'Not found.'), { status: 404 });
  }

  // Auth first — an anonymous caller can never reach IBKR or spend pacing.
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(apiError('unauthorized', 'Authentication is required.'), {
      status: 401,
      headers: { 'cache-control': 'no-store' },
    });
  }

  const result = await checkFlexConnection();

  // 200 carries the verdict either way: the CHECK completed even when the
  // connection it tested is not ready. A non-2xx would mean this endpoint
  // failed. `Retry-After` is advisory and mirrors the safe field in the body.
  const headers: Record<string, string> = { 'cache-control': 'no-store' };
  if (result.retryAfterSeconds !== undefined) {
    headers['retry-after'] = String(result.retryAfterSeconds);
  }

  return NextResponse.json(result, { headers });
}
