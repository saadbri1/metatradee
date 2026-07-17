/**
 * `/api/v1` HTTP contract (Phase 11.2) — the stable, documented shapes every
 * endpoint uses. Pure + tested. `/api/v1` is a long-term promise: additive
 * changes only within v1; breaking changes require a new version.
 */

export const API_VERSION = 'v1';

/** Documented error envelope — the SAME shape for every failure. */
export interface ApiError {
  error: { code: string; message: string; requestId?: string };
}

export function apiError(code: string, message: string, requestId?: string): ApiError {
  return { error: { code, message, ...(requestId ? { requestId } : {}) } };
}

/** Canonical error codes ↔ HTTP status. */
export const ERROR_STATUS: Record<string, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation_failed: 422,
  rate_limited: 429,
  conflict: 409,
  internal: 500,
};

export function statusFor(code: string): number {
  return ERROR_STATUS[code] ?? 400;
}

/** Cursor/keyset pagination envelope (never deep offset — scales). */
export interface Page<T> {
  data: T[];
  pagination: { nextCursor: string | null; hasMore: boolean };
}

export function page<T>(items: T[], limit: number, cursorOf: (item: T) => string): Page<T> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const last = data[data.length - 1];
  return {
    data,
    pagination: { hasMore, nextCursor: hasMore && last ? cursorOf(last) : null },
  };
}

/** Clamp a client-supplied page size to a safe bound. */
export function clampLimit(raw: unknown, def = 50, max = 200): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return def;
  return Math.min(Math.floor(n), max);
}

/**
 * Idempotency keys on mutations: a retried POST with the same key returns the
 * first result instead of double-creating. Keys are opaque, bounded, and
 * required to be well-formed (fail closed on garbage).
 */
export function isValidIdempotencyKey(key: unknown): key is string {
  return typeof key === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(key);
}
