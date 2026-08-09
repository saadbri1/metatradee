import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRedirect } from '@/features/auth/lib/redirect';
import { AUTH_ERROR_CODES, AUTH_ROUTES, DEFAULT_AUTHED_REDIRECT } from '@/features/auth/config';

/**
 * OAuth / PKCE code-exchange callback.
 *
 * THREE THINGS ARRIVE HERE AND ONLY ONE IS TRUSTWORTHY.
 *
 *   `code` — a one-time authorisation code. Exchanged server-side for a session
 *   written to cookies. Nothing about the token ever reaches the client.
 *
 *   `error` / `error_description` — set when the person pressed Cancel on
 *   Google's consent screen, or the provider refused. The description is
 *   THIRD-PARTY TEXT and is never forwarded: it would be rendered on our page,
 *   and it can contain the address that was attempted. Only our own closed
 *   error code travels onward.
 *
 *   `next` — where to land afterwards. It has been through a third party, so it
 *   is untrusted on return and goes through `sanitizeRedirect` again even
 *   though the client sanitised it on the way out.
 *
 * NO PROFILE IS CREATED HERE. Provisioning is `ensure_workspace_defaults`, an
 * idempotent RPC the `(protected)` layout runs on every authenticated render.
 * A Google user therefore gets the SAME profile structure as an email user,
 * created by the same code, and running it a second time cannot duplicate
 * anything. Adding a second creation path here is exactly how duplicate
 * profiles happen.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const providerError = searchParams.get('error');
  const next = sanitizeRedirect(searchParams.get('next'), DEFAULT_AUTHED_REDIRECT);

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`${AUTH_ROUTES.login}?error=${reason}`, origin));

  /*
   * Cancellation is not a failure, and is worth telling apart. Google sends
   * `access_denied` when someone closes the consent screen; saying "sign-in
   * failed" to a person who deliberately backed out is both wrong and alarming.
   */
  if (providerError) {
    const cancelled = providerError === 'access_denied' || providerError === 'user_cancelled_login';
    return fail(cancelled ? AUTH_ERROR_CODES.oauthCancelled : AUTH_ERROR_CODES.oauthFailed);
  }

  // No code and no error: a bare or tampered callback hit. Nothing to exchange.
  if (!code) return fail(AUTH_ERROR_CODES.callbackFailed);

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(AUTH_ERROR_CODES.oauthFailed);
  } catch {
    // Network fault reaching Supabase, or a malformed exchange.
    return fail(AUTH_ERROR_CODES.callbackFailed);
  }

  return NextResponse.redirect(new URL(next, origin));
}
