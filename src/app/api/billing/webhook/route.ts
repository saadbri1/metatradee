/**
 * Billing webhook endpoint. The provider POSTs here with no user session.
 *   1. Read the RAW body (signature is over raw bytes — never parse first).
 *   2. Verify the signature via the provider adapter (reject unsigned/forged).
 *   3. Apply idempotently with the service-role client (dedupe by event id).
 * A duplicate/replayed event is acknowledged 200 (already processed) so the
 * provider stops retrying, but is a no-op. Signature failures → 400.
 */
import { NextResponse } from 'next/server';
import { getBillingProvider } from '@/features/billing/providers/router';
import { WebhookVerificationError } from '@/features/billing/providers/types';
import { applyBillingEvent } from '@/features/billing/webhook';
import { buildPriceTierMap } from '@/features/billing/config';
import { createServiceClient } from '@/lib/supabase/service';
import { isWebhookBodyTooLarge } from '@/features/billing/webhook-limits';

export async function POST(req: Request): Promise<NextResponse> {
  // Size-cap BEFORE signature verification: never spend HMAC work or memory on
  // an oversized payload. Checked twice — declared header, then actual bytes —
  // so a missing or forged content-length cannot bypass it.
  const declaredLength = req.headers.get('content-length');
  if (isWebhookBodyTooLarge(declaredLength)) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 });
  }

  const payload = await req.text();
  if (isWebhookBodyTooLarge(null, Buffer.byteLength(payload, 'utf8'))) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 });
  }

  const signature =
    req.headers.get('stripe-signature') ?? req.headers.get('paddle-signature') ?? '';

  const provider = getBillingProvider();
  let event;
  try {
    event = provider.constructEvent(payload, signature);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
    }
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const result = await applyBillingEvent(supabase, event, buildPriceTierMap());
    // Duplicate or applied both ack 200 so the provider stops retrying.
    return NextResponse.json({
      received: true,
      applied: result.applied,
      duplicate: result.duplicate,
    });
  } catch (err) {
    // Transient failure → 500 so the provider retries later (idempotency makes
    // the retry safe).
    console.error('[billing] webhook apply failed:', (err as Error).message);
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
}
