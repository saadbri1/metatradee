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
 * RESPONSE SAFETY: the body is built field-by-field in `checkFlexConnection`.
 * No raw IBKR XML, token, query id, full account number, provider message or
 * stack trace can appear in it.
 *
 * PACING: each call costs one SendRequest plus up to a few GetStatement reads
 * against IBKR's shared limit, so a short in-process cooldown stops a held
 * refresh from throttling the token.
 */
import { NextResponse } from 'next/server';
import { apiError } from '@/features/api/http';
import { getAuthenticatedUser } from '@/features/auth/server/session';
import { checkFlexConnection } from '@/features/integrations/ibkr/connection-check';

/** Credentialed and environment-dependent: never statically rendered. */
export const dynamic = 'force-dynamic';

/** Minimum gap between probes served by one instance. */
const COOLDOWN_MS = 15_000;
let lastCheckAt = 0;

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

  const now = Date.now();
  if (now - lastCheckAt < COOLDOWN_MS) {
    return NextResponse.json(
      {
        ok: false,
        provider: 'ibkr-flex',
        environment: 'unknown',
        reportStatus: 'pacing_limit',
        category: 'pacing_limit',
        message: 'Please wait a few seconds between connection checks.',
        durationMs: 0,
      },
      { status: 429, headers: { 'cache-control': 'no-store' } },
    );
  }
  lastCheckAt = now;

  const result = await checkFlexConnection();

  // 200 carries the verdict either way: the CHECK completed even when the
  // connection it tested did not. A non-2xx would mean this endpoint failed.
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}
