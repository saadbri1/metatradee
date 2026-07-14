import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { env, serverEnv } from '@/config/env';

/**
 * Service-role Supabase client — SERVER-ONLY, RLS-bypassing. The ONLY sanctioned
 * use is trusted server-side jobs that have no user session, chiefly the billing
 * WEBHOOK handler (the provider POSTs with no cookie, yet must mirror state). It
 * throws if run in the browser or if the service key is unset, so it fails closed
 * rather than silently degrading or leaking the key client-side.
 *
 * Every caller must have already authenticated the request by other means (e.g.
 * verified webhook signature) before using this — it grants full table access.
 */
export function createServiceClient() {
  if (typeof window !== 'undefined') {
    throw new Error('createServiceClient must never be called in the browser.');
  }
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured (required for webhooks).');
  }
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
