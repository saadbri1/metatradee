'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { AUDIT_EVENTS } from '@/features/auth/config';
import { logAuditEvent } from '@/features/auth/server/audit';
import { accountDefaults } from '../domain';
import { accountCreateSchema, accountStatusSchema } from '../schemas';
import type { AccountActionResult } from '../types';

export async function createTradingAccountAction(input: unknown): Promise<AccountActionResult> {
  const parsed = accountCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'You must be signed in.' };

  const defaults = accountDefaults(parsed.data.account_type);
  const { data, error } = await supabase
    .from('trading_accounts')
    .insert({
      user_id: auth.user.id,
      name: parsed.data.name,
      account_type: parsed.data.account_type,
      provider: parsed.data.provider || null,
      broker: parsed.data.provider || null,
      external_account_identifier: parsed.data.external_account_identifier || null,
      base_currency: parsed.data.base_currency,
      starting_balance: parsed.data.starting_balance,
      account_size: parsed.data.account_size ?? null,
      ...defaults,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: 'Could not create the account.' };

  const id = (data as { id: string }).id;
  await logAuditEvent(AUDIT_EVENTS.accountCreated, { id, type: parsed.data.account_type });
  revalidatePath('/dashboard');
  revalidatePath('/journal/import');
  return { ok: true, id };
}

export async function updateTradingAccountStatusAction(
  input: unknown,
): Promise<AccountActionResult> {
  const parsed = accountStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid account status.' };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'You must be signed in.' };
  const { data, error } = await supabase
    .from('trading_accounts')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.id)
    .eq('user_id', auth.user.id)
    .select('id')
    .maybeSingle();
  if (error || !data) return { ok: false, error: 'Account not found.' };
  await logAuditEvent(AUDIT_EVENTS.accountStatusChanged, {
    id: parsed.data.id,
    status: parsed.data.status,
  });
  revalidatePath('/dashboard');
  return { ok: true, id: parsed.data.id };
}
