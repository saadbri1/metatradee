'use server';

/**
 * Auth Server Actions. Called from client hooks (TanStack mutations) with typed
 * input, but ALWAYS re-validated here with the same Zod schemas — the client is
 * never trusted. Each sensitive entry point runs the rate-limit seam first and
 * emits an audit event.
 */
import { createClient } from '@/lib/supabase/server';
import { env } from '@/config/env';
import {
  signInSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
} from '../schemas';
import { AUTH_ROUTES, AUDIT_EVENTS, RATE_LIMIT_ACTIONS, DEFAULT_AUTHED_REDIRECT } from '../config';
import { sanitizeRedirect } from '../lib/redirect';
import { enforceRateLimit } from './rate-limit';
import { logAuditEvent } from './audit';
import type { AuthActionResult } from '../types';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

function absoluteUrl(path: string): string {
  return new URL(path, env.NEXT_PUBLIC_APP_URL).toString();
}

function rateLimited(retryAfterSeconds?: number): AuthActionResult {
  return {
    ok: false,
    error: retryAfterSeconds
      ? `Too many attempts. Try again in ${retryAfterSeconds}s.`
      : 'Too many attempts. Please try again shortly.',
  };
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------
export async function signUpAction(input: unknown, next?: string): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the errors below.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const { email, password } = parsed.data;

  const limit = await enforceRateLimit(RATE_LIMIT_ACTIONS.register, email);
  if (!limit.ok) return rateLimited(limit.retryAfterSeconds);

  const supabase = await createClient();
  const redirectTo = sanitizeRedirect(next, AUTH_ROUTES.verifyEmail);
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Email verification is required; link routes to the confirm handler.
      emailRedirectTo: absoluteUrl(`${AUTH_ROUTES.confirm}?next=${encodeURIComponent(redirectTo)}`),
    },
  });

  if (error) {
    // Stay neutral on "already registered" to avoid account enumeration.
    await logAuditEvent(AUDIT_EVENTS.registered, { email, outcome: 'error' });
    return { ok: false, error: GENERIC_ERROR };
  }

  await logAuditEvent(AUDIT_EVENTS.registered, { email, outcome: 'pending_verification' });
  return { ok: true, redirectTo: AUTH_ROUTES.verifyEmail };
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
export async function signInAction(input: unknown, next?: string): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the errors below.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const { email, password } = parsed.data;

  const limit = await enforceRateLimit(RATE_LIMIT_ACTIONS.login, email);
  if (!limit.ok) return rateLimited(limit.retryAfterSeconds);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await logAuditEvent(AUDIT_EVENTS.loginFailed, { email });
    // Generic message — never reveal which of email/password was wrong.
    return { ok: false, error: 'Invalid email or password.' };
  }

  await logAuditEvent(AUDIT_EVENTS.loginSucceeded, {});
  return { ok: true, redirectTo: sanitizeRedirect(next, DEFAULT_AUTHED_REDIRECT) };
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------
export async function signOutAction(): Promise<AuthActionResult> {
  const supabase = await createClient();
  await logAuditEvent(AUDIT_EVENTS.loggedOut, {});
  await supabase.auth.signOut({ scope: 'local' });
  return { ok: true, redirectTo: AUTH_ROUTES.login };
}

/** Revoke every session for the user ("sign out everywhere"). */
export async function signOutEverywhereAction(): Promise<AuthActionResult> {
  const supabase = await createClient();
  await logAuditEvent(AUDIT_EVENTS.sessionRevoked, { scope: 'global' });
  await supabase.auth.signOut({ scope: 'global' });
  return { ok: true, redirectTo: AUTH_ROUTES.login };
}

// ---------------------------------------------------------------------------
// Forgot password (neutral, no enumeration)
// ---------------------------------------------------------------------------
export async function requestPasswordResetAction(input: unknown): Promise<AuthActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the errors below.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const { email } = parsed.data;

  const limit = await enforceRateLimit(RATE_LIMIT_ACTIONS.forgotPassword, email);
  if (!limit.ok) return rateLimited(limit.retryAfterSeconds);

  const supabase = await createClient();
  // Recovery link lands on the confirm handler, which establishes a short-lived
  // recovery session and forwards to the reset-password screen.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: absoluteUrl(
      `${AUTH_ROUTES.confirm}?next=${encodeURIComponent(AUTH_ROUTES.resetPassword)}`,
    ),
  });

  await logAuditEvent(AUDIT_EVENTS.passwordResetRequested, { email });
  // Always neutral, regardless of whether the account exists.
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reset password (requires an active recovery session from /auth/confirm)
// ---------------------------------------------------------------------------
export async function resetPasswordAction(input: unknown): Promise<AuthActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the errors below.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  // Must be in a recovery session (arrived via the emailed link).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: 'Your reset link is invalid or has expired. Request a new one.',
    };
  }

  const limit = await enforceRateLimit(RATE_LIMIT_ACTIONS.resetPassword, user.id);
  if (!limit.ok) return rateLimited(limit.retryAfterSeconds);

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { ok: false, error: GENERIC_ERROR };
  }

  await logAuditEvent(AUDIT_EVENTS.passwordResetCompleted, {});
  // Invalidate all OTHER sessions after a successful password change.
  await supabase.auth.signOut({ scope: 'others' });
  await logAuditEvent(AUDIT_EVENTS.sessionRevoked, { reason: 'password_reset' });

  return { ok: true, redirectTo: DEFAULT_AUTHED_REDIRECT };
}

// ---------------------------------------------------------------------------
// Resend verification (neutral)
// ---------------------------------------------------------------------------
export async function resendVerificationAction(input: unknown): Promise<AuthActionResult> {
  const parsed = resendVerificationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the errors below.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const { email } = parsed.data;

  const limit = await enforceRateLimit(RATE_LIMIT_ACTIONS.resendVerification, email);
  if (!limit.ok) return rateLimited(limit.retryAfterSeconds);

  const supabase = await createClient();
  await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: absoluteUrl(AUTH_ROUTES.confirm),
    },
  });

  await logAuditEvent(AUDIT_EVENTS.verificationResent, { email });
  return { ok: true };
}
