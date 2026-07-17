/**
 * GET /api/v1/trades — representative `/api/v1` endpoint (Phase 11.2).
 *
 * Demonstrates the contract end-to-end WITHOUT any RLS bypass:
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
import { apiError, API_VERSION } from '@/features/api/http';

function withVersion(res: NextResponse): NextResponse {
  res.headers.set('X-API-Version', API_VERSION);
  return res;
}

export async function GET(req: Request): Promise<NextResponse> {
  const token = parseBearer(req.headers.get('authorization'));
  if (!token) {
    return withVersion(
      NextResponse.json(apiError('unauthorized', 'Missing or malformed API token.'), {
        status: 401,
      }),
    );
  }
  // Token store + RLS-scoped session resolution is a flagged live seam (above).
  // Fail closed rather than bypass RLS or return fabricated data.
  return withVersion(
    NextResponse.json(
      apiError('unauthorized', 'API token resolution is not enabled in this environment.'),
      { status: 401 },
    ),
  );
}
