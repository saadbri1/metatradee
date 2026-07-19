/**
 * Counter store backing the pure `checkRateLimit` decision (Phase 12.1).
 *
 * SCOPE LIMITATION — DELIBERATE, NOT AN OVERSIGHT:
 * This is an in-process fixed-window counter. It lives in the memory of ONE
 * serverless instance, so budgets hold PER INSTANCE, not globally. A caller
 * spread across N warm instances effectively gets N× the budget.
 *
 * It is still a real mitigation: it stops a single-connection burst against a
 * single instance, which is the common abuse shape, and it makes the limit
 * observable via standard headers. It is NOT a substitute for a shared backend.
 *
 * Production durability REQUIRES a distributed store (Upstash/Redis). The swap
 * is intentionally trivial: replace the body of `consumeRateLimit` with an
 * atomic INCR + TTL against that backend. **No call site changes.** Until that
 * exists, the limitation above is recorded in the release notes rather than
 * papered over with a limiter that pretends to be durable.
 */
import { checkRateLimit, type RateLimitConfig, type RateLimitResult } from './rate-limit';

/** windowKey -> count. Pruned opportunistically so it cannot grow unbounded. */
const counters = new Map<string, number>();

/** Bound the map so a hostile key-space (e.g. spoofed IPs) can't exhaust memory. */
const MAX_TRACKED_KEYS = 10_000;

function windowKeyFor(subject: string, config: RateLimitConfig, now: number): string {
  const windowStart = Math.floor(now / config.windowSec) * config.windowSec;
  return `${subject}:${windowStart}`;
}

/**
 * Read the current count for `subject`, decide, and increment when allowed.
 * Returns the same `RateLimitResult` shape the pure limiter produces.
 */
export function consumeRateLimit(
  subject: string,
  config: RateLimitConfig,
  now: number = Math.floor(Date.now() / 1000),
): RateLimitResult {
  const key = windowKeyFor(subject, config, now);
  const current = counters.get(key) ?? 0;
  const result = checkRateLimit(current, config, now);

  if (result.allowed) {
    // Evict stale windows before growing; keeps memory bounded without a timer.
    if (counters.size >= MAX_TRACKED_KEYS) pruneExpired(now, config.windowSec);
    counters.set(key, current + 1);
  }
  return result;
}

/** Drop keys whose window has already closed. */
function pruneExpired(now: number, windowSec: number): void {
  const currentWindow = Math.floor(now / windowSec) * windowSec;
  for (const key of counters.keys()) {
    const start = Number(key.slice(key.lastIndexOf(':') + 1));
    if (Number.isFinite(start) && start < currentWindow) counters.delete(key);
  }
  // If everything is still in-window, the key-space itself is hostile: clear it
  // rather than grow without bound. Worst case a legitimate caller's window
  // resets early — availability is preferred over unbounded memory.
  if (counters.size >= MAX_TRACKED_KEYS) counters.clear();
}

/** Test-only: reset state between cases. */
export function resetRateLimitStore(): void {
  counters.clear();
}
