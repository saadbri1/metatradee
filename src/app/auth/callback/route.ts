import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRedirect } from '@/features/auth/lib/redirect';
import { AUTH_ROUTES } from '@/features/auth/config';

/**
 * OAuth / PKCE code-exchange callback (SEAM for social + magic-link sign-in).
 * Exchanges `?code` for a session and forwards to a sanitized internal path.
 * No provider is enabled this phase, but the endpoint is ready.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = sanitizeRedirect(searchParams.get('next'), '/account');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL(`${AUTH_ROUTES.login}?error=auth_callback_failed`, origin));
}
