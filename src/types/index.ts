/**
 * Shared domain-agnostic types. Feature-specific types live with their feature.
 * Domain types (Trade, Account, Playbook, ...) are added with their features
 * and generated from the DB/API contract — never hand-drifted.
 */

export type AppEnv = 'development' | 'preview' | 'staging' | 'production';

/** Standard API error shape (Phase 3/6 error contract). */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/** Discriminated result helper for service-layer returns. */
export type Result<T, E = ApiError> = { ok: true; data: T } | { ok: false; error: E };
