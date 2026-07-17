/**
 * Offline sync engine types (Phase 11.3). Framework-agnostic — no React Native,
 * no device APIs. The native app injects `SyncStorage` (durable) + `ApiClient`
 * (the 11.2 SDK); this engine owns the correctness rules. See
 * docs/SYNC_AND_CONFLICT_DESIGN.md.
 */

export type MutationKind = 'create' | 'edit' | 'delete';
export type QueueStatus = 'pending' | 'in_flight' | 'synced' | 'failed' | 'conflict';

export interface QueueItem {
  id: string;
  /** Client-generated ONCE at enqueue; NEVER regenerated on retry. */
  idempotencyKey: string;
  /** FIFO ordering. */
  seq: number;
  kind: MutationKind;
  /** Opaque trade input payload (never logged by the engine). */
  payload: Record<string, unknown>;
  /** Journal content hash (reuses the existing dedupe rule). */
  contentHash: string;
  /** For edits/deletes: the server version the change was based on. */
  baseVersion: number | null;
  /** Target trade id for edit/delete; null for create until synced. */
  targetId: string | null;
  status: QueueStatus;
  attempts: number;
  lastError: string | null;
}

export interface SyncSummary {
  pending: number;
  inFlight: number;
  failed: number;
  conflicts: number;
  synced: number;
  lastSyncedAt: string | null;
}

/** Durable storage the native layer provides (SQLite/MMKV/Keychain-backed). */
export interface SyncStorage {
  load(): QueueItem[];
  save(items: QueueItem[]): void;
}

/** Result of attempting one server mutation via the injected ApiClient. */
export type ApiOutcome =
  | { kind: 'ok'; targetId: string }
  | { kind: 'duplicate'; targetId: string } // idempotent hit — already exists
  | { kind: 'conflict'; server: Record<string, unknown> } // version guard tripped
  | { kind: 'gone' } // delete target already removed
  | { kind: 'retryable'; error: string } // network/5xx — retry with backoff
  | { kind: 'fatal'; error: string }; // 4xx validation — do not retry

/** The API surface the engine calls — implemented by the 11.2 SDK on device. */
export interface SyncApiClient {
  push(item: QueueItem): Promise<ApiOutcome>;
}

export type ConflictResolution = 'keep_local' | 'keep_server' | 'merge';
