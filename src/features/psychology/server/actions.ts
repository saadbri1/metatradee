'use server';

/**
 * Goals/habits/psychology mutations. Owner-scoped (RLS + explicit user_id);
 * psychology data is sensitive + private. Every mutation re-validates with the
 * shared Zod schema.
 */
import { createClient } from '@/lib/supabase/server';
import { goalSchema, habitSchema, habitLogSchema, psychologyEntrySchema } from '../schemas';
import { getPsychologyOverview, type PsychologyOverview } from './queries';
import type { ActionResult, GoalStatus } from '../types';

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

export async function getOverviewAction(): Promise<PsychologyOverview | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getPsychologyOverview(supabase, user.id);
}

export async function createGoalAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return fieldErr(parsed.error.flatten().fieldErrors);
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('goals')
    .insert({ user_id: userId, ...parsed.data })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: GENERIC };
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function setGoalStatusAction(id: string, status: GoalStatus): Promise<ActionResult> {
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('goals')
    .update({ status })
    .eq('id', id)
    .eq('user_id', userId);
  return error ? { ok: false, error: GENERIC } : { ok: true };
}

export async function deleteGoalAction(id: string): Promise<ActionResult> {
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('goals')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
  return error ? { ok: false, error: GENERIC } : { ok: true };
}

export async function createHabitAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = habitSchema.safeParse(input);
  if (!parsed.success) return fieldErr(parsed.error.flatten().fieldErrors);
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('habits')
    .insert({ user_id: userId, ...parsed.data })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: GENERIC };
  return { ok: true, data: { id: (data as { id: string }).id } };
}

/** Upsert a habit's day log (complete or mark a celebrated rest day). */
export async function logHabitAction(input: unknown): Promise<ActionResult> {
  const parsed = habitLogSchema.safeParse(input);
  if (!parsed.success) return fieldErr(parsed.error.flatten().fieldErrors);
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('habit_logs')
    .upsert({ user_id: userId, ...parsed.data }, { onConflict: 'habit_id,log_date' });
  return error ? { ok: false, error: GENERIC } : { ok: true };
}

export async function deleteHabitAction(id: string): Promise<ActionResult> {
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('habits')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
  return error ? { ok: false, error: GENERIC } : { ok: true };
}

export async function addPsychologyEntryAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = psychologyEntrySchema.safeParse(input);
  if (!parsed.success) return fieldErr(parsed.error.flatten().fieldErrors);
  const userId = await uid();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('psychology_entries')
    .insert({ user_id: userId, ...parsed.data })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: GENERIC };
  return { ok: true, data: { id: (data as { id: string }).id } };
}
