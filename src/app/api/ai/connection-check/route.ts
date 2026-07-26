/**
 * GET /api/ai/connection-check — does this deployment reach OpenAI?
 *
 * A temporary, low-cost diagnostic for verifying the OpenAI wiring in Vercel
 * Preview. It is NOT the AI Coach and returns no model output.
 *
 * RESPONSE: `{ ok: true }` or `{ ok: false, category, message }`, where
 * `category` is one of a fixed safe set. The API key, the provider's error
 * text, and the request/response bodies never appear in the response.
 *
 * NOT AVAILABLE IN PRODUCTION: the route 404s when `VERCEL_ENV` is
 * `production`, so shipping this branch can never expose a billed probe on the
 * live site. Preview is additionally behind Vercel SSO.
 *
 * COST: each allowed request is one billed `gpt-5-mini` call capped at 16
 * output tokens. A short in-process cooldown stops a held-down refresh from
 * turning into a stream of paid calls.
 */
import { NextResponse } from 'next/server';
import { checkOpenAIConnection } from '@/features/ai-coach/connection/check';

/** Billed and environment-dependent: never statically rendered or cached. */
export const dynamic = 'force-dynamic';

/** Minimum gap between probes served by one instance. */
const COOLDOWN_MS = 3_000;
let lastCheckAt = 0;

export async function GET() {
  // Fail closed outside Preview/development. `VERCEL_ENV` is set by Vercel and
  // is absent locally, where the route stays available for development.
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const now = Date.now();
  if (now - lastCheckAt < COOLDOWN_MS) {
    return NextResponse.json(
      { ok: false, category: 'quota', message: 'Please wait a moment between checks.' },
      { status: 429, headers: { 'cache-control': 'no-store' } },
    );
  }
  lastCheckAt = now;

  const result = await checkOpenAIConnection();

  // 200 carries the verdict either way: the CHECK ran successfully even when
  // the connection it tested did not. A non-2xx here would mean this endpoint
  // failed, which is a different thing.
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}
