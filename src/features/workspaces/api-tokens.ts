/**
 * Organization API tokens (Phase 11.1) — a NEW CREDENTIAL CLASS, treated as
 * secrets. Pure, deterministic, unit-tested core.
 *
 *  HASH AT REST — only SHA-256(secret) is ever stored. The plaintext exists
 *  once, at creation, in the response to the creator. It is never logged,
 *  never audited, never recoverable. The public `prefix` (mtt_ + 8 chars)
 *  identifies a token in lists without revealing the secret.
 *
 *  AUTHORITY BOUNDING — scopes map 1:1 onto the 11.0 permission grants. At
 *  CREATION a token may only receive scopes ⊆ the creator's current grants.
 *  At USE the effective authority is re-resolved: intersection(token scopes,
 *  creator's CURRENT grants). If the creator's role is reduced, the token
 *  weakens with it; if membership is gone or suspended, the token is dead.
 *  A token can NEVER exceed its creator — no RBAC bypass, by construction.
 *
 *  FAIL CLOSED — unknown, expired, revoked, malformed → deny.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { PERMISSION_MATRIX, isWorkspaceRole, type WorkspaceRole } from './roles';

export const TOKEN_PREFIX = 'mtt_';

/** Scope vocabulary — exactly the 11.0 grant strings (one permission model). */
export type TokenScope = string; // validated against the matrix, not free-form

export interface GeneratedToken {
  /** Full plaintext — shown ONCE, never stored. */
  plaintext: string;
  /** Public identifier for lists/logs (safe to display). */
  prefix: string;
  /** SHA-256 hex of the secret — the only thing persisted. */
  hash: string;
}

export function generateApiToken(): GeneratedToken {
  const secret = randomBytes(32).toString('base64url');
  const plaintext = `${TOKEN_PREFIX}${secret}`;
  return {
    plaintext,
    prefix: `${TOKEN_PREFIX}${secret.slice(0, 8)}`,
    hash: hashToken(plaintext),
  };
}

export function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/** Constant-time hash comparison. */
export function tokenHashMatches(plaintext: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(plaintext), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Scopes a role may grant = exactly its own grants (least privilege). */
export function grantableScopes(creatorRole: unknown): readonly string[] {
  if (!isWorkspaceRole(creatorRole)) return [];
  return PERMISSION_MATRIX[creatorRole as WorkspaceRole];
}

/** At creation: requested scopes must be ⊆ the creator's grants. Fail closed. */
export function validateRequestedScopes(creatorRole: unknown, requested: string[]): boolean {
  if (requested.length === 0) return false;
  const allowed = new Set(grantableScopes(creatorRole));
  if (allowed.size === 0) return false;
  return requested.every((s) => allowed.has(s));
}

export interface TokenRecord {
  hash: string;
  scopes: string[];
  expiresAt: string | null;
  revokedAt: string | null;
  /** The creator's CURRENT workspace role (null = membership gone/suspended). */
  creatorCurrentRole: WorkspaceRole | null;
}

export type TokenVerdict =
  | { ok: true; effectiveScopes: string[] }
  | { ok: false; reason: 'invalid' | 'expired' | 'revoked' | 'creator_gone' | 'no_authority' };

/**
 * Validate a presented token at USE time. Effective authority is the
 * intersection of the token's scopes with the creator's CURRENT grants —
 * so authority shrinks or dies with the creator. Fail closed everywhere.
 */
export function validateApiToken(
  plaintext: string,
  record: TokenRecord | null | undefined,
  now: Date = new Date(),
): TokenVerdict {
  if (!record || !plaintext.startsWith(TOKEN_PREFIX)) return { ok: false, reason: 'invalid' };
  if (!tokenHashMatches(plaintext, record.hash)) return { ok: false, reason: 'invalid' };
  if (record.revokedAt) return { ok: false, reason: 'revoked' };
  if (record.expiresAt && new Date(record.expiresAt).getTime() <= now.getTime()) {
    return { ok: false, reason: 'expired' };
  }
  if (!record.creatorCurrentRole || !isWorkspaceRole(record.creatorCurrentRole)) {
    return { ok: false, reason: 'creator_gone' }; // suspended/removed creator kills the token
  }
  const creatorGrants = new Set<string>(PERMISSION_MATRIX[record.creatorCurrentRole]);
  const effectiveScopes = record.scopes.filter((s) => creatorGrants.has(s));
  if (effectiveScopes.length === 0) return { ok: false, reason: 'no_authority' };
  return { ok: true, effectiveScopes };
}
