'use server';

import { revalidatePath } from 'next/cache';

/**
 * Import server actions (Phase 10.8). Design invariants:
 *
 *  WRITE THROUGH THE JOURNAL — every accepted row is re-validated with the
 *  shared `tradeCreateSchema` and written via `createTradeForUser` with
 *  { source: 'imported', importId }. `buildTradeRow` computes derived fields +
 *  content_hash exactly as for manual trades. No second math, no second table.
 *
 *  IDEMPOTENT — before writing, each row's journal content-hash is checked
 *  against the user's existing trades (indexed). A retried/resumed batch finds
 *  its hashes present and records 'duplicate' instead of inserting.
 *  `import_rows` is unique on (import_id, row_index), so bookkeeping is also
 *  retry-safe. Consistency guarantee: per-row idempotency (hash) + monotonic
 *  checkpoint — an interrupted import resumes without double-insert or loss.
 *
 *  NEVER SILENT — duplicates/partials/invalid rows are surfaced in the preview
 *  (dry run, ZERO writes) and recorded per-row; nothing is merged or dropped
 *  silently. Rollback soft-deletes (restorable) the import's trades only.
 *
 *  Owner-scoped everywhere (RLS + explicit user_id). Every job audited.
 */
import { createClient } from '@/lib/supabase/server';
import { AUDIT_EVENTS } from '@/features/auth/config';
import { logAuditEvent } from '@/features/auth/server/audit';
import { tradeCreateSchema } from '@/features/journal/schemas';
import { createTradeForUser } from '@/features/journal/server/service';
import { assertFeature, assertWithinLimit } from '@/features/billing/server/enforce';
import { getAdapter } from '../adapters';
import { buildPreview, hashCandidate, type ImportPreview } from '../pipeline';
import type { MappableField } from '../adapters';
import { ownsTradingAccount } from '@/features/accounts/server/queries';

interface ActionResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Hard cap per request/preview — clear messaging instead of a timeout. */
const MAX_ROWS_PER_PREVIEW = 50_000;
const MAX_ROWS_PER_BATCH = 500;

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { userId: user.id, supabase } : null;
}

/** Owner-scoped hash sets for dedupe against existing trades. */
async function existingHashSets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  hashes: string[],
): Promise<Set<string>> {
  if (hashes.length === 0) return new Set();
  const found = new Set<string>();
  // Bounded IN-lists keep the query planner happy on large imports.
  for (let i = 0; i < hashes.length; i += 500) {
    const { data } = await supabase
      .from('trades')
      .select('content_hash')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .in('content_hash', hashes.slice(i, i + 500));
    for (const r of (data as { content_hash: string | null }[] | null) ?? []) {
      if (r.content_hash) found.add(r.content_hash);
    }
  }
  return found;
}

/**
 * DRY RUN — zero writes. Parses nothing here (rows arrive parsed); it maps,
 * validates via the shared schema, and dedupes against the user's real trades.
 */
export async function previewImportAction(payload: {
  adapterId: string;
  mapping: Partial<Record<MappableField, number>>;
  rows: string[][];
  accountId: string | null;
}): Promise<ActionResult<ImportPreview>> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  // Broker import is a paid capability. Gated BEFORE any parsing, storage, or
  // row processing so a denied caller cannot start work via a direct action
  // call — hiding the UI is never the control. Fails closed (unresolved => Free).
  const importGate = await assertFeature(c.supabase, c.userId, 'brokerImport');
  if (!importGate.ok) {
    return { ok: false, error: importGate.reason ?? 'This is a paid feature.' };
  }
  if (!payload.accountId || !(await ownsTradingAccount(c.supabase, c.userId, payload.accountId))) {
    return { ok: false, error: 'Select a trading account you own.' };
  }
  if (payload.rows.length > MAX_ROWS_PER_PREVIEW) {
    return {
      ok: false,
      error: `This file has ${payload.rows.length.toLocaleString()} rows — the current limit is ${MAX_ROWS_PER_PREVIEW.toLocaleString()}. Split the file and import in parts.`,
    };
  }

  const adapter = getAdapter(payload.adapterId);
  // Two passes: first classify locally to learn the candidate hashes, then
  // dedupe-query ONLY those hashes (bounded IN-lists) and classify again.
  const prelim = buildPreview(payload.rows, payload.mapping, adapter, payload.accountId, new Set());
  const allHashes = [
    ...prelim.valid.map((r) => r.contentHash),
    ...prelim.duplicates.map((r) => r.contentHash),
  ];
  const existing = await existingHashSets(c.supabase, c.userId, allHashes);
  const preview = buildPreview(payload.rows, payload.mapping, adapter, payload.accountId, existing);
  return { ok: true, data: preview };
}

/** Create the import job record (called once, before the first batch). */
export async function startImportAction(payload: {
  adapterId: string;
  fileName: string | null;
  totalRows: number;
  accountId: string;
}): Promise<ActionResult<{ importId: string }>> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  // Broker import is a paid capability. Gated BEFORE any parsing, storage, or
  // row processing so a denied caller cannot start work via a direct action
  // call — hiding the UI is never the control. Fails closed (unresolved => Free).
  const importGate = await assertFeature(c.supabase, c.userId, 'brokerImport');
  if (!importGate.ok) {
    return { ok: false, error: importGate.reason ?? 'This is a paid feature.' };
  }
  if (!(await ownsTradingAccount(c.supabase, c.userId, payload.accountId))) {
    return { ok: false, error: 'Select a trading account you own.' };
  }
  const { data, error } = await c.supabase
    .from('imports')
    .insert({
      user_id: c.userId,
      adapter: payload.adapterId,
      file_name: payload.fileName,
      total_rows: payload.totalRows,
      trading_account_id: payload.accountId,
      status: 'importing',
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: 'Could not start the import.' };
  const importId = (data as { id: string }).id;
  await c.supabase
    .from('trading_accounts')
    .update({ import_status: 'syncing', status: 'syncing' })
    .eq('id', payload.accountId)
    .eq('user_id', c.userId);
  await logAuditEvent(AUDIT_EVENTS.importStarted, {
    importId,
    adapter: payload.adapterId,
    totalRows: payload.totalRows,
  });
  return { ok: true, data: { importId } };
}

export interface BatchRow {
  rowIndex: number;
  /** Raw candidate — RE-VALIDATED server-side (authoritative). */
  input: unknown;
}

export interface BatchResult {
  imported: number;
  duplicate: number;
  failed: number;
  checkpoint: number;
  capReached: boolean;
}

/**
 * Commit one bounded batch. Idempotent: re-sending the same batch never
 * double-inserts (hash check) and never double-counts (unique row_index).
 */
export async function commitImportBatchAction(payload: {
  importId: string;
  rows: BatchRow[];
}): Promise<ActionResult<BatchResult>> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  // Broker import is a paid capability. Gated BEFORE any parsing, storage, or
  // row processing so a denied caller cannot start work via a direct action
  // call — hiding the UI is never the control. Fails closed (unresolved => Free).
  const importGate = await assertFeature(c.supabase, c.userId, 'brokerImport');
  if (!importGate.ok) {
    return { ok: false, error: importGate.reason ?? 'This is a paid feature.' };
  }
  if (payload.rows.length > MAX_ROWS_PER_BATCH) {
    return { ok: false, error: `Batches are limited to ${MAX_ROWS_PER_BATCH} rows.` };
  }

  // Ownership check on the job (RLS also enforces).
  const { data: job } = await c.supabase
    .from('imports')
    .select('id, status, checkpoint, imported_rows, duplicate_rows, failed_rows')
    .eq('id', payload.importId)
    .eq('user_id', c.userId)
    .single();
  if (!job) return { ok: false, error: 'Import not found.' };
  const jobRow = job as {
    status: string;
    checkpoint: number;
    imported_rows: number;
    duplicate_rows: number;
    failed_rows: number;
  };
  if (jobRow.status === 'cancelled' || jobRow.status === 'rolled_back') {
    return { ok: false, error: 'This import was cancelled.' };
  }

  // Billing gate: plan trade cap enforced server-side, before the batch.
  const { count } = await c.supabase
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', c.userId)
    .is('deleted_at', null);
  let currentCount = count ?? 0;
  const gate = await assertWithinLimit(c.supabase, c.userId, 'maxTrades', currentCount);
  if (!gate.ok) return { ok: false, error: gate.reason ?? 'Plan limit reached.' };
  const limit = gate.entitlement.limits.maxTrades;

  let imported = 0;
  let duplicate = 0;
  let failed = 0;
  let capReached = false;
  let checkpoint = jobRow.checkpoint;

  // Re-validate + hash the whole batch first, then dedupe in one query.
  const validated = payload.rows.map((r) => {
    const parsed = tradeCreateSchema.safeParse(r.input);
    return { rowIndex: r.rowIndex, parsed };
  });
  const hashes = validated.flatMap((v) =>
    v.parsed.success ? [hashCandidate(v.parsed.data).full] : [],
  );
  const existing = await existingHashSets(c.supabase, c.userId, hashes);

  for (const v of validated) {
    let status: 'imported' | 'duplicate' | 'invalid' | 'failed' = 'failed';
    let tradeId: string | null = null;
    let errors: string[] = [];

    if (!v.parsed.success) {
      status = 'invalid';
      errors = v.parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      failed++;
    } else if (limit !== null && currentCount >= limit) {
      // Honest partial stop at the plan cap — remaining rows stay retryable.
      capReached = true;
      break;
    } else {
      const input = v.parsed.data;
      const { full } = hashCandidate(input);
      if (existing.has(full)) {
        status = 'duplicate';
        duplicate++;
      } else {
        const res = await createTradeForUser(c.supabase, c.userId, input, {
          source: 'imported',
          importId: payload.importId,
        });
        if (res.ok && res.id) {
          status = 'imported';
          tradeId = res.id;
          imported++;
          currentCount++;
          existing.add(full); // in-batch dedupe going forward
        } else {
          status = 'failed';
          errors = [res.error ?? 'Insert failed'];
          failed++;
        }
      }
    }

    // Idempotent bookkeeping: unique(import_id,row_index) → retry-safe upsert.
    await c.supabase.from('import_rows').upsert(
      {
        import_id: payload.importId,
        user_id: c.userId,
        row_index: v.rowIndex,
        content_hash: v.parsed.success ? hashCandidate(v.parsed.data).full : null,
        status,
        errors,
        trade_id: tradeId,
      },
      { onConflict: 'import_id,row_index' },
    );
    checkpoint = Math.max(checkpoint, v.rowIndex);
  }

  await c.supabase
    .from('imports')
    .update({
      checkpoint,
      imported_rows: jobRow.imported_rows + imported,
      duplicate_rows: jobRow.duplicate_rows + duplicate,
      failed_rows: jobRow.failed_rows + failed,
    })
    .eq('id', payload.importId)
    .eq('user_id', c.userId);

  return { ok: true, data: { imported, duplicate, failed, checkpoint, capReached } };
}

/** Mark the job finished (called after the last batch). Audited. */
export async function finishImportAction(importId: string): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const { data } = await c.supabase
    .from('imports')
    .update({ status: 'completed' })
    .eq('id', importId)
    .eq('user_id', c.userId)
    .select('trading_account_id, imported_rows, duplicate_rows, failed_rows')
    .single();
  const accountId = (data as { trading_account_id?: string | null } | null)?.trading_account_id;
  if (accountId) {
    await c.supabase
      .from('trading_accounts')
      .update({
        import_status: 'ready',
        status: 'active',
        last_successful_import_at: new Date().toISOString(),
      })
      .eq('id', accountId)
      .eq('user_id', c.userId);
  }
  await logAuditEvent(AUDIT_EVENTS.importCompleted, { importId, ...(data ?? {}) });
  return { ok: true };
}

/** Mark a partial or interrupted import as failed; imported rows remain auditable and retry-safe. */
export async function failImportAction(
  importId: string,
  reason = 'Import batch failed.',
): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const { data } = await c.supabase
    .from('imports')
    .update({ status: 'failed', error: reason.slice(0, 500) })
    .eq('id', importId)
    .eq('user_id', c.userId)
    .select('trading_account_id')
    .maybeSingle();
  if (!data) return { ok: false, error: 'Import not found.' };
  const accountId = (data as { trading_account_id: string | null }).trading_account_id;
  if (accountId) {
    await c.supabase
      .from('trading_accounts')
      .update({ import_status: 'sync_failed', status: 'sync_failed' })
      .eq('id', accountId)
      .eq('user_id', c.userId);
  }
  await logAuditEvent(AUDIT_EVENTS.importFailed, { importId, reason: reason.slice(0, 200) });
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function cancelImportAction(importId: string): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const { data } = await c.supabase
    .from('imports')
    .update({ status: 'cancelled' })
    .eq('id', importId)
    .eq('user_id', c.userId)
    .select('trading_account_id')
    .maybeSingle();
  const accountId = (data as { trading_account_id?: string | null } | null)?.trading_account_id;
  if (accountId) {
    await c.supabase
      .from('trading_accounts')
      .update({ import_status: 'import_required', status: 'import_required' })
      .eq('id', accountId)
      .eq('user_id', c.userId);
  }
  await logAuditEvent(AUDIT_EVENTS.importCancelled, { importId });
  return { ok: true };
}

/**
 * Rollback: SOFT-delete only this import's trades (restorable via the journal),
 * never silently destroying data. Leaves import_rows for the audit trail.
 */
export async function rollbackImportAction(importId: string): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const { error } = await c.supabase
    .from('trades')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', c.userId)
    .eq('import_id', importId)
    .is('deleted_at', null);
  if (error) return { ok: false, error: 'Rollback failed.' };
  await c.supabase
    .from('imports')
    .update({ status: 'rolled_back' })
    .eq('id', importId)
    .eq('user_id', c.userId);
  await logAuditEvent(AUDIT_EVENTS.importRolledBack, { importId });
  return { ok: true };
}

export interface ImportListItem {
  id: string;
  adapter: string;
  file_name: string | null;
  status: string;
  total_rows: number;
  imported_rows: number;
  duplicate_rows: number;
  failed_rows: number;
  created_at: string;
}

export async function listImportsAction(): Promise<ImportListItem[]> {
  const c = await ctx();
  if (!c) return [];
  const { data } = await c.supabase
    .from('imports')
    .select(
      'id, adapter, file_name, status, total_rows, imported_rows, duplicate_rows, failed_rows, created_at',
    )
    .eq('user_id', c.userId)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data as ImportListItem[] | null) ?? [];
}

/** Per-row log for the error report (owner-scoped). */
export async function getImportRowsAction(
  importId: string,
  status?: 'failed' | 'invalid' | 'duplicate',
): Promise<{ row_index: number; status: string; errors: string[] }[]> {
  const c = await ctx();
  if (!c) return [];
  let q = c.supabase
    .from('import_rows')
    .select('row_index, status, errors')
    .eq('user_id', c.userId)
    .eq('import_id', importId)
    .order('row_index')
    .limit(1000);
  if (status) q = q.eq('status', status);
  const { data } = await q;
  return (data as { row_index: number; status: string; errors: string[] }[] | null) ?? [];
}
