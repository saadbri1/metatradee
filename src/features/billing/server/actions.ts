'use server';

/**
 * Billing server actions. Auth-first, owner-scoped. Checkout + portal are
 * PROVIDER-HOSTED (the user never enters card data in our app). No charge,
 * proration, or tax is computed here — the provider does it. Every action is
 * audited. Entitlement reads fail closed to Free.
 */
import { createClient } from '@/lib/supabase/server';
import { getBillingProvider, isBillingMock } from '../providers/router';
import { getEntitlement, getMirroredSubscription, getInvoices } from './queries';
import { priceIdFor } from '../config';
import { checkoutSchema } from '../schemas';
import { PLANS } from '../plans';
import { env } from '@/config/env';
import type { Entitlement, Invoice, MirroredSubscription } from '../types';

interface ActionResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}
const GENERIC = 'Something went wrong with billing. Please try again.';

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { userId: user.id, supabase } : null;
}

async function audit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  action: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await supabase.from('billing_audit').insert({ user_id: userId, action, metadata });
}

export interface BillingOverview {
  entitlement: Entitlement;
  subscription: MirroredSubscription | null;
  invoices: Invoice[];
  mock: boolean;
}

export async function getBillingOverviewAction(): Promise<BillingOverview | null> {
  const c = await ctx();
  if (!c) return null;
  const [entitlement, subscription, invoices] = await Promise.all([
    getEntitlement(c.supabase, c.userId),
    getMirroredSubscription(c.supabase, c.userId),
    getInvoices(c.supabase, c.userId),
  ]);
  return { entitlement, subscription, invoices, mock: isBillingMock() };
}

/** Just the entitlement (read-only capability flags for the client). */
export async function getEntitlementAction(): Promise<Entitlement | null> {
  const c = await ctx();
  if (!c) return null;
  return getEntitlement(c.supabase, c.userId);
}

/** Start provider-hosted checkout. Returns a redirect URL — never handles cards. */
export async function createCheckoutAction(input: unknown): Promise<ActionResult<{ url: string }>> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid plan selection.' };
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const { tier, interval, couponCode } = parsed.data;

  try {
    const { data: customer } = await c.supabase
      .from('billing_customers')
      .select('provider_customer_id')
      .eq('user_id', c.userId)
      .maybeSingle();

    const provider = getBillingProvider();
    const base = env.NEXT_PUBLIC_APP_URL;
    const session = await provider.createCheckoutSession({
      providerCustomerId:
        (customer as { provider_customer_id: string } | null)?.provider_customer_id ?? null,
      priceId: priceIdFor(tier, interval),
      trialDays: PLANS[tier].trialDays,
      couponId: couponCode,
      clientReferenceId: c.userId,
      successUrl: `${base}/billing?checkout=success`,
      cancelUrl: `${base}/billing?checkout=cancelled`,
    });
    await audit(c.supabase, c.userId, 'checkout_started', { tier, interval });
    return { ok: true, data: { url: session.url } };
  } catch (err) {
    console.error('[billing] checkout failed:', (err as Error).message);
    return { ok: false, error: GENERIC };
  }
}

/** Open the provider-hosted portal (update card / invoices / cancel). */
export async function createPortalAction(): Promise<ActionResult<{ url: string }>> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  try {
    const { data: customer } = await c.supabase
      .from('billing_customers')
      .select('provider_customer_id')
      .eq('user_id', c.userId)
      .maybeSingle();
    const providerCustomerId = (customer as { provider_customer_id: string } | null)
      ?.provider_customer_id;
    if (!providerCustomerId)
      return { ok: false, error: 'No billing account yet — start a plan first.' };

    const provider = getBillingProvider();
    const session = await provider.createPortalSession({
      providerCustomerId,
      returnUrl: `${env.NEXT_PUBLIC_APP_URL}/billing`,
    });
    await audit(c.supabase, c.userId, 'portal_opened');
    return { ok: true, data: { url: session.url } };
  } catch (err) {
    console.error('[billing] portal failed:', (err as Error).message);
    return { ok: false, error: GENERIC };
  }
}
