'use server';

/**
 * Strategy/playbook/template/adherence server actions. Every mutation validates
 * with the shared Zod schema and is owner-scoped (RLS + explicit user_id).
 * Versioning is APPEND-ONLY: a rule/field change writes a new immutable snapshot
 * and bumps current_version; restore writes a NEW version (non-destructive).
 * Strategy performance is never stored — it's computed via 9.8.
 */
import { createClient } from '@/lib/supabase/server';
import { AUDIT_EVENTS } from '@/features/auth/config';
import { logAuditEvent } from '@/features/auth/server/audit';
import {
  strategyCreateSchema,
  strategyUpdateSchema,
  playbookSchema,
  adherenceSchema,
} from '../schemas';
import { snapshotStrategy, diffSnapshots } from '../version';
import { canTransition } from '../status';
import { validateTemplate, templateToStrategyInput, exportTemplate } from '../template';
import { getStrategy, getStrategyPerformance, type StrategyPerformance } from './queries';
import type { ActionResult, StrategyRow, StrategyStatus } from '../types';

export async function getStrategyPerformanceAction(
  strategyId: string,
): Promise<StrategyPerformance | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getStrategyPerformance(supabase, user.id, strategyId);
}

const GENERIC = 'Something went wrong. Please try again.';

async function uid(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function fieldErr<T = undefined>(e: Record<string, string[] | undefined>): ActionResult<T> {
  return {
    ok: false,
    error: 'Please fix the errors below.',
    fieldErrors: e as Record<string, string[]>,
  };
}

export async function createStrategyAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = strategyCreateSchema.safeParse(input);
  if (!parsed.success) return fieldErr(parsed.error.flatten().fieldErrors);
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };

  const supabase = await createClient();
  const row = {
    user_id: userId,
    ...parsed.data,
    description: parsed.data.description || null,
    notes: parsed.data.notes || null,
    color: parsed.data.color || null,
    current_version: 1,
  };
  const { data, error } = await supabase.from('strategies').insert(row).select('id').single();
  if (error || !data) return { ok: false, error: GENERIC };
  const id = (data as { id: string }).id;

  await supabase.from('strategy_versions').insert({
    strategy_id: id,
    user_id: userId,
    version: 1,
    content: snapshotStrategy(parsed.data as Partial<StrategyRow>),
    change_note: 'Initial version',
  });
  await logAuditEvent(AUDIT_EVENTS.strategyCreated, { id });
  return { ok: true, data: { id } };
}

export async function updateStrategyAction(id: string, input: unknown): Promise<ActionResult> {
  const parsed = strategyUpdateSchema.safeParse(input);
  if (!parsed.success) return fieldErr(parsed.error.flatten().fieldErrors);
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };

  const supabase = await createClient();
  const current = await getStrategy(supabase, userId, id);
  if (!current) return { ok: false, error: 'Strategy not found.' };

  const merged = { ...current, ...parsed.data } as StrategyRow;
  const diff = diffSnapshots(snapshotStrategy(current), snapshotStrategy(merged));
  const nextVersion = diff.length > 0 ? current.current_version + 1 : current.current_version;

  const { error } = await supabase
    .from('strategies')
    .update({ ...parsed.data, current_version: nextVersion })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) return { ok: false, error: GENERIC };

  if (diff.length > 0) {
    await supabase.from('strategy_versions').insert({
      strategy_id: id,
      user_id: userId,
      version: nextVersion,
      content: snapshotStrategy(merged),
      change_note: `Updated ${diff.map((d) => d.field).join(', ')}`,
    });
    await logAuditEvent(AUDIT_EVENTS.strategyVersioned, { id, version: nextVersion });
  }
  await logAuditEvent(AUDIT_EVENTS.strategyUpdated, { id });
  return { ok: true };
}

export async function changeStrategyStatusAction(
  id: string,
  status: StrategyStatus,
): Promise<ActionResult> {
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = await createClient();
  const current = await getStrategy(supabase, userId, id);
  if (!current) return { ok: false, error: 'Strategy not found.' };
  if (!canTransition(current.status, status)) {
    return { ok: false, error: `Cannot move from ${current.status} to ${status}.` };
  }
  const { error } = await supabase
    .from('strategies')
    .update({ status })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) return { ok: false, error: GENERIC };
  await logAuditEvent(AUDIT_EVENTS.strategyStatusChanged, { id, status });
  return { ok: true };
}

export async function setStrategyPinnedAction(id: string, pinned: boolean): Promise<ActionResult> {
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('strategies')
    .update({ is_pinned: pinned })
    .eq('id', id)
    .eq('user_id', userId);
  return error ? { ok: false, error: GENERIC } : { ok: true };
}

export async function deleteStrategyAction(id: string): Promise<ActionResult> {
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('strategies')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) return { ok: false, error: GENERIC };
  await logAuditEvent(AUDIT_EVENTS.strategyDeleted, { id });
  return { ok: true };
}

/** Restore a prior version's content as a NEW version (non-destructive). */
export async function restoreStrategyVersionAction(
  id: string,
  version: number,
): Promise<ActionResult> {
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = await createClient();
  const current = await getStrategy(supabase, userId, id);
  if (!current) return { ok: false, error: 'Strategy not found.' };

  const { data: snap } = await supabase
    .from('strategy_versions')
    .select('content')
    .eq('user_id', userId)
    .eq('strategy_id', id)
    .eq('version', version)
    .maybeSingle();
  if (!snap) return { ok: false, error: 'Version not found.' };

  const content = (snap as { content: Record<string, unknown> }).content;
  const nextVersion = current.current_version + 1;
  const { error } = await supabase
    .from('strategies')
    .update({ ...content, current_version: nextVersion })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) return { ok: false, error: GENERIC };

  await supabase.from('strategy_versions').insert({
    strategy_id: id,
    user_id: userId,
    version: nextVersion,
    content,
    change_note: `Restored from v${version}`,
  });
  await logAuditEvent(AUDIT_EVENTS.strategyVersioned, {
    id,
    version: nextVersion,
    restoredFrom: version,
  });
  return { ok: true };
}

export async function upsertAdherenceAction(
  tradeId: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = adherenceSchema.safeParse(input);
  if (!parsed.success) return fieldErr(parsed.error.flatten().fieldErrors);
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('trade_strategy_adherence')
    .upsert({ trade_id: tradeId, user_id: userId, ...parsed.data }, { onConflict: 'trade_id' });
  return error ? { ok: false, error: GENERIC } : { ok: true };
}

export async function importTemplateAction(
  payload: unknown,
  name: string,
): Promise<ActionResult<{ id: string }>> {
  const check = validateTemplate(payload);
  if (!check.ok) return { ok: false, error: check.error };
  return createStrategyAction(templateToStrategyInput(check.data.content, name));
}

export async function saveStrategyAsTemplateAction(id: string): Promise<ActionResult> {
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = await createClient();
  const strategy = await getStrategy(supabase, userId, id);
  if (!strategy) return { ok: false, error: 'Strategy not found.' };
  const tpl = exportTemplate(strategy);
  const { error } = await supabase.from('strategy_templates').insert({
    user_id: userId,
    name: tpl.name,
    schema_version: tpl.schema_version,
    author: tpl.author,
    content: tpl.content,
  });
  return error ? { ok: false, error: GENERIC } : { ok: true };
}

export async function createPlaybookAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = playbookSchema.safeParse(input);
  if (!parsed.success) return fieldErr(parsed.error.flatten().fieldErrors);
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('playbooks')
    .insert({ user_id: userId, ...parsed.data, description: parsed.data.description || null })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: GENERIC };
  return { ok: true, data: { id: (data as { id: string }).id } };
}
