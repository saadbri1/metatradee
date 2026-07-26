import 'server-only';

/**
 * Durable pending-report state.
 *
 * WHY THIS REPLACED IN-PROCESS MEMORY: Vercel instances are ephemeral and
 * concurrent. Memory-only state meant a cold start or a second instance had no
 * pending reference and issued a fresh `/SendRequest` — which is exactly how the
 * endpoint ended up returning a byte-identical `report_pending` forever.
 *
 * The database is the primary store. The in-memory store remains ONLY as a
 * degraded fallback for environments where the table or the service-role key is
 * unavailable, and the caller is told which one is actually in use — the
 * response reports `stateStore: 'database' | 'memory'` truthfully, because
 * claiming durability we do not have would hide this exact class of bug.
 *
 * NO SECRET IS STORED. Sessions are keyed by salted SHA-256 fingerprints of the
 * token and query id; neither is reversible, and neither is ever returned.
 */
import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';
import type { FlexErrorCategory } from './types';

const TABLE = 'integration_report_sessions';
export const PROVIDER = 'ibkr-flex';

/** How long a pending session may live before it is abandoned. */
export const SESSION_TTL_MS = 20 * 60_000;

export type SessionStatus = 'pending' | 'ready' | 'failed' | 'timeout';
export type StateStoreKind = 'database' | 'memory';

export interface ReportSession {
  referenceCode: string | null;
  status: SessionStatus;
  attempts: number;
  createdAt: number;
  lastCheckedAt: number | null;
  nextAllowedCheckAt: number;
  expiresAt: number;
  terminalErrorCategory: FlexErrorCategory | null;
}

export interface SessionKey {
  credentialFingerprint: string;
  queryFingerprint: string;
}

/** Salted, one-way fingerprint. Never reversible to the credential. */
export function fingerprint(value: string, salt: string): string {
  return createHash('sha256').update(`metatradee:${salt}:${value}`).digest('hex').slice(0, 48);
}

export function sessionKey(token: string, queryId: string): SessionKey {
  return {
    credentialFingerprint: fingerprint(token, 'flex-token'),
    queryFingerprint: fingerprint(queryId, 'flex-query'),
  };
}

export interface ReportSessionStore {
  readonly kind: StateStoreKind;
  /**
   * The pending session, or null when there is none.
   *
   * An EXPIRED session is still returned. Expiry is a decision for the caller —
   * a store that silently dropped it would make `report_timeout` unreachable and
   * quietly start a brand-new report instead of reporting the timeout.
   */
  getPending(key: SessionKey, now: number): Promise<ReportSession | null>;
  /** Create or replace the pending session. */
  upsertPending(key: SessionKey, session: ReportSession): Promise<void>;
  /** Close the session out — succeeded, failed terminally, or timed out. */
  close(
    key: SessionKey,
    status: Exclude<SessionStatus, 'pending'>,
    category: FlexErrorCategory | null,
    now: number,
  ): Promise<void>;
}

// ---------------------------------------------------------------------------
// Database store (primary)
// ---------------------------------------------------------------------------

interface SessionRow {
  reference_code: string | null;
  status: SessionStatus;
  attempts: number;
  created_at: string;
  last_checked_at: string | null;
  next_allowed_check_at: string;
  expires_at: string;
  terminal_error_category: string | null;
}

function toSession(row: SessionRow): ReportSession {
  return {
    referenceCode: row.reference_code,
    status: row.status,
    attempts: row.attempts,
    createdAt: Date.parse(row.created_at),
    lastCheckedAt: row.last_checked_at ? Date.parse(row.last_checked_at) : null,
    nextAllowedCheckAt: Date.parse(row.next_allowed_check_at),
    expiresAt: Date.parse(row.expires_at),
    terminalErrorCategory: (row.terminal_error_category as FlexErrorCategory | null) ?? null,
  };
}

export function databaseStore(client: ReturnType<typeof createServiceClient>): ReportSessionStore {
  const match = (key: SessionKey) => ({
    provider: PROVIDER,
    credential_fingerprint: key.credentialFingerprint,
    query_fingerprint: key.queryFingerprint,
  });

  return {
    kind: 'database',

    async getPending(key) {
      const { data, error } = await client
        .from(TABLE)
        .select(
          'reference_code, status, attempts, created_at, last_checked_at, next_allowed_check_at, expires_at, terminal_error_category',
        )
        .match({ ...match(key), status: 'pending' })
        .maybeSingle();

      if (error || !data) return null;
      // Returned even when expired — the caller decides (see interface note).
      return toSession(data as SessionRow);
    },

    async upsertPending(key, session) {
      await client.from(TABLE).upsert(
        {
          ...match(key),
          reference_code: session.referenceCode,
          status: 'pending',
          attempts: session.attempts,
          created_at: new Date(session.createdAt).toISOString(),
          last_checked_at: session.lastCheckedAt
            ? new Date(session.lastCheckedAt).toISOString()
            : null,
          next_allowed_check_at: new Date(session.nextAllowedCheckAt).toISOString(),
          expires_at: new Date(session.expiresAt).toISOString(),
          terminal_error_category: null,
        },
        { onConflict: 'provider,credential_fingerprint,query_fingerprint' },
      );
    },

    async close(key, status, category, now) {
      await client
        .from(TABLE)
        .update({
          status,
          terminal_error_category: category,
          last_checked_at: new Date(now).toISOString(),
        })
        .match({ ...match(key), status: 'pending' });
    },
  };
}

// ---------------------------------------------------------------------------
// Memory store (degraded fallback only)
// ---------------------------------------------------------------------------

const memory = new Map<string, ReportSession>();

/** Test-only: clear the fallback store. */
export function __resetMemoryStore(): void {
  memory.clear();
}

export function memoryStore(): ReportSessionStore {
  const id = (key: SessionKey) => `${key.credentialFingerprint}:${key.queryFingerprint}`;
  return {
    kind: 'memory',
    async getPending(key) {
      const session = memory.get(id(key));
      if (!session || session.status !== 'pending') return null;
      return session;
    },
    async upsertPending(key, session) {
      memory.set(id(key), session);
    },
    async close(key) {
      memory.delete(id(key));
    },
  };
}

/**
 * Resolve the store to use.
 *
 * Prefers the database. Falls back to memory — and says so — when the
 * service-role key is absent or the client cannot be constructed, rather than
 * throwing and taking the whole diagnostic down.
 */
export async function resolveStore(): Promise<{
  store: ReportSessionStore;
  degradedReason?: string;
}> {
  try {
    const client = createServiceClient();
    const store = databaseStore(client);
    // Probe once: a missing table or key must degrade, not 500.
    const { error } = await client.from(TABLE).select('status').limit(1);
    if (error) {
      return {
        store: memoryStore(),
        degradedReason: 'The integration_report_sessions table is not available.',
      };
    }
    return { store };
  } catch {
    return {
      store: memoryStore(),
      degradedReason: 'SUPABASE_SERVICE_ROLE_KEY is not configured for this environment.',
    };
  }
}
