/**
 * POST /api/support-chat — one turn of the MetaTradee Assistant conversation.
 *
 * WHY A ROUTE HANDLER AND NOT A SERVER ACTION: this is a read-only question
 * answered many times per visit. A server action would tie every turn to a
 * POST-and-revalidate round trip through the router; a route handler keeps the
 * turn a plain fetch the client can abort when the visitor closes the panel.
 *
 * WHAT IT NEVER RETURNS: a model's raw output, a provider error, an API key, or
 * a claim that is not in `knowledge.ts`. `composeAnswer` is responsible for all
 * of that; this file's job is the boundary — validation, rate limiting, and
 * turning failures into a shape the client can render in three languages.
 *
 * NOT CACHED, EVER. The answer depends on the request body, and a cached
 * support reply is a wrong support reply.
 */
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { chatRequestSchema } from '@/features/support-chat/schemas';
import { composeAnswer } from '@/features/support-chat/server/answer';

export const dynamic = 'force-dynamic';

/**
 * Per-origin throttle.
 *
 * A turn can reach a paid model, so an unbounded endpoint is an unbounded bill.
 * The same caveat as the contact form applies: one serverless instance does not
 * share this map, so it flattens a burst from a single origin rather than
 * guaranteeing a global cap. It is the cheap first line, and the grounded
 * answer path costs nothing when no provider is configured.
 */
const WINDOW_MS = 5 * 60 * 1000;
const MAX_TURNS_PER_WINDOW = 20;
const turns = new Map<string, number[]>();

function rateLimited(origin: string, now: number): boolean {
  for (const [key, times] of turns) {
    const kept = times.filter((t) => now - t < WINDOW_MS);
    if (kept.length) turns.set(key, kept);
    else turns.delete(key);
  }
  const recent = turns.get(origin) ?? [];
  if (recent.length >= MAX_TURNS_PER_WINDOW) return true;
  turns.set(origin, [...recent, now]);
  return false;
}

/** Coarse origin key. Counted only — never logged, emailed or persisted. */
async function originKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
}

/** A closed set the client maps to translated copy. Never prose from here. */
type ErrorCode = 'invalid_request' | 'rate_limited' | 'server_error';

function fail(code: ErrorCode, status: number) {
  return NextResponse.json({ error: code }, { status, headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_request', 400);
  }

  const parsed = chatRequestSchema.safeParse(body);
  // The issues are NOT returned: they would echo the submitted content back.
  if (!parsed.success) return fail('invalid_request', 400);

  if (rateLimited(await originKey(), Date.now())) return fail('rate_limited', 429);

  try {
    const reply = await composeAnswer(parsed.data);
    return NextResponse.json(reply, { headers: { 'cache-control': 'no-store' } });
  } catch (err) {
    /*
     * Only the error NAME is logged. A thrown provider error can carry the
     * request body, and this line ends up in a log aggregator.
     */
    console.error(
      `[support-chat] answer failed: ${err instanceof Error ? err.name : 'unknown error'}`,
    );
    return fail('server_error', 500);
  }
}
