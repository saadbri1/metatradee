import 'server-only';

/**
 * The credential boundary.
 *
 * Application code NEVER reads `IBKR_FLEX_TOKEN` / `IBKR_FLEX_QUERY_ID`. It
 * asks a `FlexCredentialSource` for a credential and receives a value. That
 * indirection is the whole point: the environment variables are a temporary,
 * single-account Preview test credential, and the real design is per-user
 * connections holding their own encrypted token and query id.
 *
 * When that lands, it implements this same interface — a new source object —
 * and neither the client, the parser, nor the route changes.
 */
import { serverEnv } from '@/config/env';
import type { FlexCredentials } from './types';

export interface FlexCredentialSource {
  /** A label for diagnostics. Never contains any part of a secret. */
  readonly id: string;
  /** Resolve credentials, or null when this source has none configured. */
  getCredentials(): Promise<FlexCredentials | null>;
}

/**
 * TEMPORARY source backed by environment variables.
 *
 * Scope-limited on purpose:
 * - it is the only module in the codebase that reads these two variables;
 * - it is `server-only`, so importing it from a client component is a build
 *   error rather than a runtime leak;
 * - it returns null (rather than throwing or half-configuring) when either
 *   value is absent, so the caller fails closed with `missing_configuration`
 *   and makes no request at all.
 */
export const envFlexCredentialSource: FlexCredentialSource = {
  id: 'env:preview-test-account',
  async getCredentials(): Promise<FlexCredentials | null> {
    const env = serverEnv();
    const token = env.IBKR_FLEX_TOKEN?.trim();
    const queryId = env.IBKR_FLEX_QUERY_ID?.trim();
    if (!token || !queryId) return null;
    return { token, queryId };
  },
};

/**
 * A fixed credential, for a caller that already holds one — the shape a
 * per-user connection will use once credentials are decrypted from storage.
 */
export function staticFlexCredentialSource(
  credentials: FlexCredentials,
  id = 'static',
): FlexCredentialSource {
  return { id, getCredentials: async () => credentials };
}
