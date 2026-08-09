import { type NextRequest, NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRedirect } from '@/features/auth/lib/redirect';
import {
  AUTH_ERROR_CODES,
  AUTH_ROUTES,
  AUDIT_EVENTS,
  DEFAULT_AUTHED_REDIRECT,
} from '@/features/auth/config';
import { logAuditEvent } from '@/features/auth/server/audit';
import { clearPendingVerificationEmail } from '@/features/auth/server/pending-email';

/**
 * Email confirmation and password-recovery handler (token-hash flow).
 *
 * EXPIRED AND INVALID ARE DIFFERENT PROBLEMS, so they get different answers.
 * An expired link means "you waited too long, get another" — a solvable,
 * unalarming situation, and by far the most common one, because confirmation
 * links are short-lived and people open mail hours later. An invalid one means
 * the link was mangled, already used, or forged. Telling someone their link is
 * "not valid" when it merely aged is how a working signup gets abandoned.
 *
 * ALREADY-VERIFIED IS NOT AN ERROR EITHER. Clicking the link a second time — a
 * double tap, a prefetching mail client, a forwarded message — lands here with
 * a spent token. If the visitor already has a verified session, send them where
 * they were going instead of showing a failure for something that succeeded.
 */

/** Supabase reports an aged token in a few shapes; treat them all as expired. */
function isExpired(message: string | undefined, code: string | null): boolean {
  if (code === 'otp_expired') return true;
  const text = (message ?? '').toLowerCase();
  return text.includes('expired');
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = sanitizeRedirect(searchParams.get('next'), DEFAULT_AUTHED_REDIRECT);

  const supabase = await createClient();

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`${AUTH_ROUTES.verifyEmail}?error=${reason}`, origin));

  /*
   * Supabase can bounce straight here with its own error rather than a token —
   * an already-consumed link, most often. Same shape as the OAuth callback: its
   * description is third-party text and never travels onward.
   */
  const suppliedError = searchParams.get('error') ?? searchParams.get('error_code');

  if (!tokenHash || !type) {
    if (suppliedError) {
      return fail(
        isExpired(undefined, searchParams.get('error_code'))
          ? AUTH_ERROR_CODES.verificationExpired
          : AUTH_ERROR_CODES.verificationFailed,
      );
    }
    return fail(AUTH_ERROR_CODES.verificationFailed);
  }

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    /*
     * Before calling it a failure: is this person already signed in and
     * verified? Then the token was simply spent — by them, a moment ago — and
     * the right answer is the destination, not an error page.
     */
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email_confirmed_at) {
      return NextResponse.redirect(new URL(next, origin));
    }

    return fail(
      isExpired(error.message, searchParams.get('error_code'))
        ? AUTH_ERROR_CODES.verificationExpired
        : AUTH_ERROR_CODES.verificationFailed,
    );
  }

  if (type === 'signup' || type === 'email') {
    await logAuditEvent(AUDIT_EVENTS.emailVerified, {});
    // The address is confirmed; the hint cookie has done its job.
    await clearPendingVerificationEmail();
  }

  return NextResponse.redirect(new URL(next, origin));
}
