/**
 * Request-derived helpers for `/api/v1` (Phase 12.1). Pure and tested.
 */
import { hashToken } from '@/features/workspaces/api-tokens';

/**
 * Best-effort client IP.
 *
 * TRUST NOTE: `x-forwarded-for` is client-controllable in general. Behind
 * Vercel's proxy the LEFTMOST entry is the real client and upstream values are
 * appended, so we take the first hop. If this ever runs without a trusted proxy
 * in front, the value is spoofable and IP-keyed limiting degrades accordingly —
 * which is why an authenticated caller is always keyed by token instead.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Stable rate-limit subject key.
 *
 * An authenticated caller is keyed by a SHA-256 of their token (reusing the
 * same hashing the token store uses) so the raw credential never becomes a map
 * key, never appears in memory dumps, and never reaches a log. Anonymous
 * callers fall back to client IP so unauthenticated probing is still throttled.
 */
export function rateLimitSubject(req: Request, token: string | null): string {
  if (token) return `tok:${hashToken(token)}`;
  return `ip:${clientIp(req)}`;
}
