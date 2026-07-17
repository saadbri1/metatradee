/**
 * API authentication + scope enforcement (Phase 11.2). REUSES the 11.1 token
 * model — no second token system. The API is NOT a bypass: token validity and
 * authority are re-resolved on every request via `validateApiToken`, so a
 * token can never exceed its owner's CURRENT authority, and all data access
 * still flows through the owner-scoped services + RLS (the route layer calls
 * existing services, never the DB directly).
 */
import { validateApiToken, TOKEN_PREFIX, type TokenRecord } from '@/features/workspaces/api-tokens';

/** Extract a bearer token from an Authorization header. Fail closed. */
export function parseBearer(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = header.match(/^Bearer\s+(\S+)$/i);
  const tok = m?.[1];
  return tok && tok.startsWith(TOKEN_PREFIX) ? tok : null;
}

export type AuthResult =
  | { ok: true; effectiveScopes: string[] }
  | { ok: false; status: 401 | 403; code: 'unauthorized' | 'forbidden'; message: string };

/**
 * Resolve a presented token against its stored record (fetched by the caller,
 * hash-matched here) + the required scope. Returns 401 for bad credentials,
 * 403 for insufficient scope — both fail closed.
 */
export function authorize(
  plaintext: string | null,
  record: TokenRecord | null,
  requiredScope: string,
): AuthResult {
  if (!plaintext) {
    return {
      ok: false,
      status: 401,
      code: 'unauthorized',
      message: 'Missing or malformed API token.',
    };
  }
  const v = validateApiToken(plaintext, record);
  if (!v.ok) {
    return {
      ok: false,
      status: 401,
      code: 'unauthorized',
      message: 'Invalid, expired, or revoked API token.',
    };
  }
  if (!v.effectiveScopes.includes(requiredScope)) {
    return {
      ok: false,
      status: 403,
      code: 'forbidden',
      message: `This token lacks the required scope: ${requiredScope}.`,
    };
  }
  return { ok: true, effectiveScopes: v.effectiveScopes };
}

/**
 * SENSITIVE-DATA GATE: psychology/personal endpoints require BOTH a dedicated
 * scope AND the data owner's explicit opt-in. An org/admin/coach token can
 * never reach it — the scope maps to a personal grant no workspace role holds,
 * so `validateApiToken` never yields it for a delegated token.
 */
export const PSYCHOLOGY_SCOPE = 'psychology:read:self';

export function canReadPsychology(effectiveScopes: string[], ownerOptedIn: boolean): boolean {
  return ownerOptedIn && effectiveScopes.includes(PSYCHOLOGY_SCOPE);
}
