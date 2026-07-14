import { type NextRequest, NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRedirect } from '@/features/auth/lib/redirect';
import { AUTH_ROUTES, AUDIT_EVENTS } from '@/features/auth/config';
import { logAuditEvent } from '@/features/auth/server/audit';

/**
 * Email confirmation & recovery handler (token-hash flow). Supabase confirm /
 * reset emails link here; we verify the OTP (which establishes the session via
 * cookies) and forward to a sanitized internal path. Never an open redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = sanitizeRedirect(searchParams.get('next'), '/account');

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      if (type === 'signup' || type === 'email') {
        await logAuditEvent(AUDIT_EVENTS.emailVerified, {});
      }
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL(`${AUTH_ROUTES.login}?error=verification_failed`, origin));
}
