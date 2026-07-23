'use server';

/**
 * Trade CRUD + bulk actions. Every write re-validates with the shared Zod schema
 * and goes through the central trade service (createTradeForUser / buildTradeRow)
 * so derived fields + dedupe hashing are identical to any other write path.
 * RLS + explicit user_id scoping enforce owner-only. Important actions audited.
 */
import { createClient } from '@/lib/supabase/server';
import { AUDIT_EVENTS } from '@/features/auth/config';
import { logAuditEvent } from '@/features/auth/server/audit';
import { tradeCreateSchema, tradeUpdateSchema, bulkTradeIdsSchema } from '../schemas';
import type { TradeCreateInput } from '../schemas';
import { assertWithinLimit } from '@/features/billing/server/enforce';
import { createTradeForUser, findFullDuplicate, buildTradeRow } from './service';
import { getTrade, getTradeSummary, listTrades } from './queries';
import type { ActionResult, JournalSummary, TradePage } from '../types';
import type { TradeFilters, TradeSort } from '../filters';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

export async function fetchTradesPageAction(params: {
  filters?: TradeFilters;
  sort?: TradeSort;
  cursor?: string | null;
  limit?: number;
}): Promise<TradePage> {
  const userId = await uid();
  if (!userId) return { items: [], nextCursor: null };
  const supabase = await createClient();
  return listTrades(supabase, userId, params);
}

async function uid(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function fieldErrors(e: Record<string, string[] | undefined>): ActionResult {
  return {
    ok: false,
    error: 'Please fix the errors below.',
    fieldErrors: e as Record<string, string[]>,
  };
}

export interface CreateTradeActionResult {
  ok: boolean;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  duplicateOf?: string;
}

export async function createTradeAction(
  input: unknown,
  options: { force?: boolean } = {},
): Promise<CreateTradeActionResult> {
  const parsed = tradeCreateSchema.safeParse(input);
  if (!parsed.success) {
    return fieldErrors(parsed.error.flatten().fieldErrors) as CreateTradeActionResult;
  }
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };

  const supabase = await createClient();

  // Billing gate (9.14): enforce the plan's trade cap SERVER-SIDE (fail-closed).
  // Free is capped; over-limit creation is rejected here, not just hidden in UI.
  // Existing trades are never touched — only new over-limit additions are blocked.
  const { count } = await supabase
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('deleted_at', null);
  const gate = await assertWithinLimit(supabase, userId, 'maxTrades', count ?? 0);
  if (!gate.ok) {
    return { ok: false, error: gate.reason ?? 'Plan limit reached. Upgrade to add more trades.' };
  }

  // Duplicate detection surfaces before save (never silently dropped/merged).
  if (!options.force) {
    const dup = await findFullDuplicate(supabase, userId, parsed.data);
    if (dup) {
      return {
        ok: false,
        error: 'A matching trade already exists. Import anyway?',
        duplicateOf: dup,
      };
    }
  }

  const result = await createTradeForUser(supabase, userId, parsed.data, {
    source: 'manual',
  });
  if (!result.ok || !result.id) return { ok: false, error: GENERIC_ERROR };

  await logAuditEvent(AUDIT_EVENTS.tradeCreated, { id: result.id });
  return { ok: true, id: result.id };
}

export async function updateTradeAction(id: string, input: unknown): Promise<ActionResult> {
  const parsed = tradeUpdateSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error.flatten().fieldErrors);

  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };

  const supabase = await createClient();
  const current = await getTrade(supabase, userId, id);
  if (!current) return { ok: false, error: 'Trade not found.' };

  // Merge current + changes, then rebuild the row so derived fields + hash stay
  // authoritative and consistent with a fresh create.
  const merged = { ...current, ...parsed.data } as unknown as TradeCreateInput;
  const row = buildTradeRow(merged, userId, { source: current.source });
  delete (row as Record<string, unknown>).user_id;

  const { error } = await supabase.from('trades').update(row).eq('id', id).eq('user_id', userId);
  if (error) return { ok: false, error: GENERIC_ERROR };

  // Replace tag links when tag_ids provided.
  if (parsed.data.tag_ids) {
    await supabase.from('trade_tags').delete().eq('user_id', userId).eq('trade_id', id);
    if (parsed.data.tag_ids.length > 0) {
      await supabase
        .from('trade_tags')
        .insert(parsed.data.tag_ids.map((tag_id) => ({ trade_id: id, tag_id, user_id: userId })));
    }
  }

  if (parsed.data.visibility && parsed.data.visibility !== current.visibility) {
    await logAuditEvent(AUDIT_EVENTS.tradeVisibilityChanged, {
      id,
      to: parsed.data.visibility,
    });
  }
  return { ok: true };
}

export async function duplicateTradeAction(id: string): Promise<CreateTradeActionResult> {
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };

  const supabase = await createClient();
  const current = await getTrade(supabase, userId, id);
  if (!current) return { ok: false, error: 'Trade not found.' };

  const copy = {
    ...current,
    symbol: current.symbol,
    status: 'draft',
    tag_ids: current.tag_ids,
  } as unknown as TradeCreateInput;

  const result = await createTradeForUser(supabase, userId, copy, { source: 'manual' });
  if (!result.ok || !result.id) return { ok: false, error: GENERIC_ERROR };
  await logAuditEvent(AUDIT_EVENTS.tradeCreated, { id: result.id, duplicatedFrom: id });
  return { ok: true, id: result.id };
}

async function setTimestamp(
  id: string,
  column: 'deleted_at' | 'archived_at',
  value: string | null,
): Promise<ActionResult> {
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('trades')
    .update({ [column]: value })
    .eq('id', id)
    .eq('user_id', userId);
  return error ? { ok: false, error: GENERIC_ERROR } : { ok: true };
}

export async function softDeleteTradeAction(id: string): Promise<ActionResult> {
  const res = await setTimestamp(id, 'deleted_at', new Date().toISOString());
  if (res.ok) await logAuditEvent(AUDIT_EVENTS.tradeDeleted, { id });
  return res;
}

export async function restoreTradeAction(id: string): Promise<ActionResult> {
  const res = await setTimestamp(id, 'deleted_at', null);
  if (res.ok) await logAuditEvent(AUDIT_EVENTS.tradeRestored, { id });
  return res;
}

export async function archiveTradeAction(id: string, archived: boolean): Promise<ActionResult> {
  const res = await setTimestamp(id, 'archived_at', archived ? new Date().toISOString() : null);
  if (res.ok) await logAuditEvent(AUDIT_EVENTS.tradeArchived, { id, archived });
  return res;
}

export async function setTradeFlagAction(
  id: string,
  flag: 'is_favorite' | 'is_pinned',
  value: boolean,
): Promise<ActionResult> {
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('trades')
    .update({ [flag]: value })
    .eq('id', id)
    .eq('user_id', userId);
  return error ? { ok: false, error: GENERIC_ERROR } : { ok: true };
}

/**
 * Toggle the Journal review state for one trade. Real, owner-scoped persistence
 * against the trades.reviewed column. Returns a clear error when the column has
 * not been applied yet, so the optimistic UI rolls back honestly.
 */
export async function setTradeReviewedAction(id: string, value: boolean): Promise<ActionResult> {
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('trades')
    .update({ reviewed: value })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) {
    if (/reviewed/i.test(error.message ?? '')) {
      return { ok: false, error: 'Review state is unavailable until the database is updated.' };
    }
    return { ok: false, error: GENERIC_ERROR };
  }
  return { ok: true };
}

// --- bulk (transactional per-statement; honest partial results) ------------
async function bulkSet(
  ids: string[],
  patch: Record<string, unknown>,
): Promise<ActionResult<{ affected: number }>> {
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('trades')
    .update(patch)
    .eq('user_id', userId)
    .in('id', ids)
    .select('id');
  if (error) return { ok: false, error: GENERIC_ERROR };
  return { ok: true, data: { affected: (data as unknown[] | null)?.length ?? 0 } };
}

export async function bulkDeleteTradesAction(
  input: unknown,
): Promise<ActionResult<{ affected: number }>> {
  const parsed = bulkTradeIdsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Select at least one trade.' };
  const res = await bulkSet(parsed.data.ids, { deleted_at: new Date().toISOString() });
  if (res.ok)
    await logAuditEvent(AUDIT_EVENTS.tradeBulk, { op: 'delete', count: res.data?.affected });
  return res;
}

export async function bulkArchiveTradesAction(
  input: unknown,
): Promise<ActionResult<{ affected: number }>> {
  const parsed = bulkTradeIdsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Select at least one trade.' };
  const res = await bulkSet(parsed.data.ids, { archived_at: new Date().toISOString() });
  if (res.ok)
    await logAuditEvent(AUDIT_EVENTS.tradeBulk, { op: 'archive', count: res.data?.affected });
  return res;
}

export async function bulkRestoreTradesAction(
  input: unknown,
): Promise<ActionResult<{ affected: number }>> {
  const parsed = bulkTradeIdsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Select at least one trade.' };
  const res = await bulkSet(parsed.data.ids, { deleted_at: null });
  if (res.ok)
    await logAuditEvent(AUDIT_EVENTS.tradeBulk, { op: 'restore', count: res.data?.affected });
  return res;
}

export async function bulkSetReviewedAction(
  input: unknown,
  reviewed: boolean,
): Promise<ActionResult<{ affected: number }>> {
  const parsed = bulkTradeIdsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Select at least one trade.' };
  const res = await bulkSet(parsed.data.ids, { reviewed });
  if (res.ok)
    await logAuditEvent(AUDIT_EVENTS.tradeBulk, {
      op: reviewed ? 'review' : 'unreview',
      count: res.data?.affected,
    });
  return res;
}

/** Aggregate the four Journal KPIs over the filtered set (server-computed). */
export async function fetchTradeSummaryAction(params: {
  filters?: TradeFilters;
}): Promise<JournalSummary> {
  const empty: JournalSummary = {
    totalTrades: 0,
    decidedTrades: 0,
    netProfit: 0,
    profitFactor: null,
    winRate: null,
    wins: 0,
    losses: 0,
    breakEven: 0,
    avgWin: null,
    avgLoss: null,
    currency: 'USD',
  };
  const userId = await uid();
  if (!userId) return empty;
  const supabase = await createClient();
  return getTradeSummary(supabase, userId, params.filters ?? {});
}
