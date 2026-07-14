import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/config/env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Supabase client for Server Components / Route Handlers / Server Actions.
 * Reads and writes the auth cookie so sessions persist across requests.
 * Still anon-key + RLS scoped; never the service-role key.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component where cookies are read-only.
          // Session refresh is handled by middleware; safe to ignore here.
        }
      },
    },
  });
}
