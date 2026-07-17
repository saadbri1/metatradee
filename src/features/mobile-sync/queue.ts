/**
 * Durable, idempotent, resumable sync queue (Phase 11.3). Pure engine: all
 * persistence goes through the injected `SyncStorage`, so it survives app
 * kill/restart with no hidden in-memory truth. Reuses the Journal content-hash
 * dedupe rule — no second definition. See docs/SYNC_AND_CONFLICT_DESIGN.md.
 */
import { tradeContentHash } from '@/features/journal/dedupe';
import type {
  ApiOutcome,
  MutationKind,
  QueueItem,
  SyncApiClient,
  SyncStorage,
  SyncSummary,
} from './types';

/** Deterministic backoff (seconds) by attempt; past the end → `failed`. */
export const BACKOFF_SEC = [2, 8, 30, 120, 600] as const;

export function nextBackoff(attempts: number): number | null {
  return attempts < BACKOFF_SEC.length ? (BACKOFF_SEC[attempts] as number) : null;
}

/** Content hash for a trade-input payload — the SAME rule as journal/import. */
export function payloadHash(payload: Record<string, unknown>): string {
  return tradeContentHash({
    trading_account_id: (payload.trading_account_id as string | null) ?? null,
    symbol: String(payload.symbol ?? ''),
    direction: String(payload.direction ?? ''),
    time: (payload.executed_at as string) ?? (payload.opened_at as string) ?? null,
    quantity: (payload.quantity as number | null) ?? null,
    entry_price: (payload.entry_price as number | null) ?? null,
  });
}

export class SyncQueue {
  private items: QueueItem[];
  private lastSyncedAt: string | null = null;

  constructor(
    private readonly storage: SyncStorage,
    private readonly api: SyncApiClient,
    /** Injected id generator (device provides a UUID; tests provide a stub). */
    private readonly newId: () => string,
  ) {
    this.items = storage.load();
  }

  private persist(): void {
    this.storage.save(this.items);
  }

  private nextSeq(): number {
    return this.items.reduce((max, i) => Math.max(max, i.seq), 0) + 1;
  }

  /**
   * Enqueue a mutation. The idempotency key is minted ONCE here and reused on
   * every retry. A create whose content hash already sits unsynced in the queue
   * is de-duplicated locally too (double-tap protection).
   */
  enqueue(
    kind: MutationKind,
    payload: Record<string, unknown>,
    opts: { targetId?: string | null; baseVersion?: number | null } = {},
  ): QueueItem {
    const contentHash = payloadHash(payload);
    if (kind === 'create') {
      const existing = this.items.find(
        (i) => i.kind === 'create' && i.contentHash === contentHash && i.status !== 'failed',
      );
      if (existing) return existing; // local double-tap dedupe
    }
    const item: QueueItem = {
      id: this.newId(),
      idempotencyKey: this.newId(),
      seq: this.nextSeq(),
      kind,
      payload,
      contentHash,
      baseVersion: opts.baseVersion ?? null,
      targetId: opts.targetId ?? null,
      status: 'pending',
      attempts: 0,
      lastError: null,
    };
    this.items.push(item);
    this.persist();
    return item;
  }

  /** Items awaiting delivery, in FIFO order (pending + resumable in_flight). */
  private drivable(): QueueItem[] {
    return this.items
      .filter((i) => i.status === 'pending' || i.status === 'in_flight')
      .sort((a, b) => a.seq - b.seq);
  }

  /**
   * Drive the queue once (online). Idempotent + resumable: re-driving an
   * `in_flight` item never double-inserts because the server dedupes on the
   * idempotency key / content hash. Returns the outcomes for the caller/UI.
   */
  async drive(now: () => string = () => new Date().toISOString()): Promise<ApiOutcome[]> {
    const outcomes: ApiOutcome[] = [];
    for (const item of this.drivable()) {
      item.status = 'in_flight';
      this.persist();
      const outcome = await this.api.push(item);
      outcomes.push(outcome);
      this.apply(item, outcome, now);
      this.persist();
    }
    return outcomes;
  }

  private apply(item: QueueItem, outcome: ApiOutcome, now: () => string): void {
    switch (outcome.kind) {
      case 'ok':
      case 'duplicate': // idempotent hit — treated as success, NOT a new write
        item.status = 'synced';
        item.targetId = outcome.targetId;
        item.lastError = null;
        this.lastSyncedAt = now();
        break;
      case 'gone': // delete target already removed — success (no-op)
        item.status = 'synced';
        this.lastSyncedAt = now();
        break;
      case 'conflict':
        item.status = 'conflict'; // surfaced to the user; never auto-resolved
        break;
      case 'retryable': {
        item.attempts += 1;
        item.lastError = outcome.error;
        item.status = nextBackoff(item.attempts) === null ? 'failed' : 'pending';
        break;
      }
      case 'fatal':
        item.attempts += 1;
        item.lastError = outcome.error;
        item.status = 'failed'; // validation error — surfaced, never dropped
        break;
    }
  }

  /** Prune synced items (they hold no further value). */
  prune(): void {
    this.items = this.items.filter((i) => i.status !== 'synced');
    this.persist();
  }

  /** Mark a resolved conflict for re-drive with the user's chosen payload. */
  resolveConflict(itemId: string, resolvedPayload: Record<string, unknown>): void {
    const item = this.items.find((i) => i.id === itemId);
    if (!item || item.status !== 'conflict') return;
    item.payload = resolvedPayload;
    item.contentHash = payloadHash(resolvedPayload);
    item.status = 'pending';
    item.attempts = 0;
    item.lastError = null;
    this.persist();
  }

  /** Retry a failed item (user-initiated). */
  retry(itemId: string): void {
    const item = this.items.find((i) => i.id === itemId);
    if (item && item.status === 'failed') {
      item.status = 'pending';
      item.attempts = 0;
      this.persist();
    }
  }

  summary(): SyncSummary {
    const by = (s: QueueItem['status']) => this.items.filter((i) => i.status === s).length;
    return {
      pending: by('pending'),
      inFlight: by('in_flight'),
      failed: by('failed'),
      conflicts: by('conflict'),
      synced: by('synced'),
      lastSyncedAt: this.lastSyncedAt,
    };
  }

  /** Read-only snapshot (for the UI / tests). */
  all(): readonly QueueItem[] {
    return this.items;
  }

  /** Purge EVERYTHING — called on logout / workspace switch (no cross-account bleed). */
  purge(): void {
    this.items = [];
    this.lastSyncedAt = null;
    this.persist();
  }
}
