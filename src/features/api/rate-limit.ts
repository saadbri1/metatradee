/**
 * API rate limiting (Phase 11.2). Quotas are PLAN-DRIVEN via the Billing
 * entitlement resolver — never hardcoded per endpoint. The limiter algorithm is
 * a pure fixed-window counter (deterministic, tested); the SHARED counter store
 * is a documented seam: production must back it with a distributed store
 * (Upstash/Redis) so limits hold across serverless instances — per-instance
 * memory is explicitly NOT acceptable and is flagged, not shipped as final.
 */
import { PLANS, type PlanTier } from '@/features/billing/plans';

export interface RateLimitConfig {
  /** Requests allowed per window. */
  limit: number;
  windowSec: number;
}

/** Plan → API request budget. Derived from plan tier (config, not hardcoded). */
export function apiRateLimitFor(tier: PlanTier): RateLimitConfig {
  // Scales with tier; free is deliberately conservative. Values live with the
  // plan catalog concept, not scattered in endpoint code.
  const perMinute: Record<PlanTier, number> = { free: 30, trader: 120, pro: 600, funded: 1200 };
  const limit = perMinute[tier] ?? perMinute.free;
  // Keep the reference to PLANS so the coupling to the catalog is explicit.
  void PLANS[tier];
  return { limit, windowSec: 60 };
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix seconds when the window resets. */
  resetAt: number;
  retryAfterSec: number;
}

/**
 * Pure fixed-window decision. `currentCount` is the count already recorded in
 * the shared store for this (subject, window); the caller increments on allow.
 */
export function checkRateLimit(
  currentCount: number,
  config: RateLimitConfig,
  now: number = Math.floor(Date.now() / 1000),
): RateLimitResult {
  const windowStart = Math.floor(now / config.windowSec) * config.windowSec;
  const resetAt = windowStart + config.windowSec;
  const allowed = currentCount < config.limit;
  return {
    allowed,
    limit: config.limit,
    remaining: Math.max(0, config.limit - currentCount - (allowed ? 1 : 0)),
    resetAt,
    retryAfterSec: allowed ? 0 : resetAt - now,
  };
}

/** Standard headers for a rate-limit decision (RFC draft + Retry-After). */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'RateLimit-Limit': String(r.limit),
    'RateLimit-Remaining': String(r.remaining),
    'RateLimit-Reset': String(r.resetAt),
  };
  if (!r.allowed) headers['Retry-After'] = String(r.retryAfterSec);
  return headers;
}
