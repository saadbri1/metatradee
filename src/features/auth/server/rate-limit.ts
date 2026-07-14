/**
 * Rate-limiting / brute-force protection SEAM.
 *
 * Every sensitive auth entry point (register, login, forgot, reset, resend)
 * calls `enforceRateLimit(...)` BEFORE touching Supabase, so a real limiter
 * (e.g. Upstash Ratelimit, or a Postgres/Redis token bucket) can be dropped in
 * here without changing any call site. This phase is a no-op that always allows.
 */
import type { RateLimitAction } from '../config';

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the caller may retry, when limited. */
  retryAfterSeconds?: number;
}

/**
 * @param _action  which entry point is being guarded
 * @param _identifier stable key for the caller (IP, email hash, or both)
 */
export async function enforceRateLimit(
  _action: RateLimitAction,
  _identifier: string,
): Promise<RateLimitResult> {
  // TODO(security): plug in the limiter store (Phase: rate-limiting). Wire it to
  // return { ok: false, retryAfterSeconds } when a bucket is exhausted.
  return { ok: true };
}
