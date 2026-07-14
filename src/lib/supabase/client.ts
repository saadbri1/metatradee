import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/config/env';

/**
 * Supabase client for Client Components (browser).
 * Uses the anon key; all access is governed by Row-Level Security.
 */
export function createClient() {
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
