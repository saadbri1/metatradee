/**
 * Billing reads. Owner-scoped. Entitlement resolution FAILS CLOSED: any read
 * error or missing mirror collapses to the Free plan (never grants paid access
 * on uncertainty). This is the server-authoritative capability source.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveEntitlement, FREE } from '../entitlements';
import type { Entitlement, Invoice, MirroredSubscription } from '../types';
import { isValidTier } from '../plans';

export async function getMirroredSubscription(
  supabase: SupabaseClient,
  userId: string,
): Promise<MirroredSubscription | null> {
  const { data, error } = await supabase
    .from('billing_subscriptions')
    .select('tier, status, current_period_end, cancel_at_period_end, trial_end')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    tier: string;
    status: MirroredSubscription['status'];
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    trial_end: string | null;
  };
  if (!isValidTier(row.tier)) return null;
  return {
    tier: row.tier,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    trialEnd: row.trial_end,
  };
}

/** Server-authoritative entitlement. Fail-closed to Free on ANY error. */
export async function getEntitlement(
  supabase: SupabaseClient,
  userId: string,
): Promise<Entitlement> {
  try {
    const sub = await getMirroredSubscription(supabase, userId);
    return resolveEntitlement(sub);
  } catch {
    return FREE;
  }
}

/** Real counts behind the plan limits, so the billing page shows facts. */
export interface PlanUsage {
  trades: number;
  accounts: number;
  playbooks: number;
}

/**
 * Owner-scoped counts for the limits the app enforces. A failed count reports 0
 * rather than a guess — an unknown number must never be presented as usage.
 */
export async function getPlanUsage(supabase: SupabaseClient, userId: string): Promise<PlanUsage> {
  const countRows = async (table: string, softDeleted: boolean): Promise<number> => {
    let query = supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (softDeleted) query = query.is('deleted_at', null);
    const { count, error } = await query;
    return error ? 0 : (count ?? 0);
  };

  const [trades, accounts, playbooks] = await Promise.all([
    countRows('trades', true),
    countRows('trading_accounts', false),
    countRows('strategies', false),
  ]);
  return { trades, accounts, playbooks };
}

export async function getInvoices(supabase: SupabaseClient, userId: string): Promise<Invoice[]> {
  const { data } = await supabase
    .from('billing_invoices')
    .select(
      'provider_invoice_id, number, amount_due, amount_paid, currency, status, period_start, period_end, hosted_invoice_url, pdf_url, created_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    providerInvoiceId: r.provider_invoice_id as string,
    number: (r.number as string | null) ?? null,
    amountDue: (r.amount_due as number) ?? 0,
    amountPaid: (r.amount_paid as number) ?? 0,
    currency: (r.currency as string) ?? 'usd',
    status: (r.status as string) ?? 'open',
    periodStart: (r.period_start as string | null) ?? null,
    periodEnd: (r.period_end as string | null) ?? null,
    hostedInvoiceUrl: (r.hosted_invoice_url as string | null) ?? null,
    pdfUrl: (r.pdf_url as string | null) ?? null,
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  }));
}
