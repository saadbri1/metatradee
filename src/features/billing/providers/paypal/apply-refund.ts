/**
 * Applying a refund or reversal to the payment record — SERVER ONLY.
 *
 * The arithmetic lives in refunds.ts; this is the part that touches rows, kept
 * separate so the rules can be tested without a database and this file has one
 * job: read the payment, work out the plan, write it.
 *
 * ORDER OF WRITES MATTERS. The refunded row is demoted FIRST and the survivor
 * clamped second. Demoting first means that if the second write fails, the user
 * is left with less access than they paid for rather than more — the money has
 * already gone back, so over-granting is the worse of the two failures, and
 * PayPal retries the event either way.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  planRevocation,
  timestampColumnFor,
  type RefundStatus,
  type SurvivingWindow,
} from './refunds';
import type { BillingInterval } from '../../pricing';

export type RefundOutcome =
  'applied' | 'unknown_capture' | 'already_refunded' | 'stale_event' | 'storage_error';

export interface RefundResult {
  outcome: RefundOutcome;
  /** The user's expiry after the refund, for the log. Absent when nothing changed. */
  accessExpiresAt?: string;
}

interface PaymentRow {
  id: string;
  user_id: string;
  billing_interval: BillingInterval;
  payment_status: string;
  access_starts_at: string | null;
  access_expires_at: string | null;
  refunded_at: string | null;
  reversed_at: string | null;
}

/**
 * Revoke the unused access a capture bought.
 *
 * @param captureId  provider_capture_id of the ORIGINAL payment — the unique
 *                   key the grant was written under, so this addresses exactly
 *                   the payment being reversed and no other.
 * @param occurredAt When PayPal says the money went back.
 */
export async function applyRefund(
  supabase: SupabaseClient,
  captureId: string,
  status: RefundStatus,
  occurredAt: Date,
): Promise<RefundResult> {
  const { data, error } = await supabase
    .from('paypal_payments')
    .select(
      'id, user_id, billing_interval, payment_status, access_starts_at, access_expires_at, refunded_at, reversed_at',
    )
    .eq('provider_capture_id', captureId)
    .maybeSingle();

  if (error) return { outcome: 'storage_error' };

  /*
   * A capture we have no record of. Acknowledged, never an error: it may be a
   * payment from another environment sharing the sandbox account, or one whose
   * grant was never written. Returning 5xx would make PayPal retry an event
   * that can never succeed.
   */
  const row = data as PaymentRow | null;
  if (!row) return { outcome: 'unknown_capture' };

  /*
   * IDEMPOTENCY, and the staleness guard in one check. A row that is already
   * REFUNDED or REVERSED has had its window nulled and its claw-back applied;
   * a redelivered event, or a late REFUNDED arriving after a REVERSED, must
   * not subtract those days a second time.
   */
  if (row.payment_status !== 'COMPLETED') {
    return { outcome: 'already_refunded' };
  }
  if (row.refunded_at !== null || row.reversed_at !== null) {
    return { outcome: 'already_refunded' };
  }

  // The user's live expiry, across every COMPLETED row including this one.
  const { data: liveRows, error: liveError } = await supabase
    .from('paypal_payments')
    .select('id, access_starts_at, access_expires_at')
    .eq('user_id', row.user_id)
    .eq('payment_status', 'COMPLETED')
    .order('access_expires_at', { ascending: false });

  if (liveError) return { outcome: 'storage_error' };

  const live =
    (liveRows as { id: string; access_starts_at: string; access_expires_at: string }[]) ?? [];
  const currentExpiry = live[0]?.access_expires_at ? new Date(live[0].access_expires_at) : null;

  /*
   * The furthest-out window among the rows that will REMAIN completed — i.e.
   * every live row except the one being refunded. This is what a separate
   * successful payment has bought, and it is the row the claw-back has to be
   * written onto when the refunded payment is not itself the max holder.
   */
  const remaining = live.filter((r) => r.id !== row.id);
  const survivorRow = remaining[0] ?? null;
  const survivor: SurvivingWindow | null = survivorRow
    ? {
        accessStartsAt: new Date(survivorRow.access_starts_at),
        accessExpiresAt: new Date(survivorRow.access_expires_at),
      }
    : null;

  const plan = planRevocation(row.billing_interval, currentExpiry, occurredAt, survivor);

  /*
   * Demote the refunded row. Its window is nulled because the table forbids a
   * non-COMPLETED row from holding one — which is also what removes it from
   * every entitlement read, since those filter on COMPLETED.
   *
   * Conditioned on payment_status still being COMPLETED so two concurrent
   * deliveries cannot both pass the check above and both apply.
   */
  const { data: demoted, error: demoteError } = await supabase
    .from('paypal_payments')
    .update({
      payment_status: status,
      [timestampColumnFor(status)]: occurredAt.toISOString(),
      access_starts_at: null,
      access_expires_at: null,
    })
    .eq('id', row.id)
    .eq('payment_status', 'COMPLETED')
    .select('id');

  if (demoteError) return { outcome: 'storage_error' };
  // Lost the race: another delivery demoted it first. Not an error.
  if (!demoted || (demoted as unknown[]).length === 0) {
    return { outcome: 'already_refunded' };
  }

  // Clamp the survivor only when the refunded row was not the max holder.
  if (survivorRow && plan.survivorExpiry) {
    const { error: clampError } = await supabase
      .from('paypal_payments')
      .update({ access_expires_at: plan.survivorExpiry.toISOString() })
      .eq('id', survivorRow.id)
      .eq('payment_status', 'COMPLETED');
    if (clampError) return { outcome: 'storage_error' };
  }

  return {
    outcome: 'applied',
    accessExpiresAt: (plan.survivorExpiry ?? plan.targetExpiry).toISOString(),
  };
}
