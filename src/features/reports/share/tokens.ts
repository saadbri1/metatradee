/**
 * Share-link crypto. Server-side only (uses node:crypto). Tokens are 256 bits of
 * CSPRNG entropy (unguessable). Passwords are salted-SHA-256 hashed — the raw
 * password is never stored, and verification is constant-time.
 */
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

/** 43-char base64url token = 256 bits of entropy. Practically unguessable. */
export function generateShareToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Random salt for a share password. */
export function generateSalt(): string {
  return randomBytes(16).toString('base64url');
}

export function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${password}`).digest('base64');
}

/** Constant-time password check against a stored salt+hash. */
export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashPassword(password, salt));
  const expected = Buffer.from(expectedHash);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** A share is valid only if not revoked and not past its expiry. */
export function isShareLive(
  share: { revokedAt: string | null; expiresAt: string | null },
  now = new Date(),
): boolean {
  if (share.revokedAt) return false;
  if (share.expiresAt && new Date(share.expiresAt).getTime() <= now.getTime()) return false;
  return true;
}
