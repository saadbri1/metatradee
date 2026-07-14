/**
 * Server-side session & guard utilities. Import these from Server Components,
 * layouts, Route Handlers, and Server Actions — never trust the client for auth.
 *
 * These reuse the existing SSR Supabase server client (cookie-based sessions);
 * no new client is created.
 */
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { AUTH_ROUTES, DEFAULT_AUTHED_REDIRECT, NEXT_PARAM } from '../config';
import { sanitizeRedirect } from '../lib/redirect';
import type { AuthenticatedUser, Entitlements, MfaState } from '../types';
import { resolveEntitlementsFromMetadata } from '../enterprise/rbac';

/**
 * RBAC seam. Everything role/permission/org-related resolves HERE so guards and
 * pages never hardcode roles. Roles come from tamper-proof `app_metadata`
 * (admin/service-set); the `organization_members` table is the management
 * system-of-record that keeps it in sync. Fails closed to `member`.
 */
export function resolveEntitlements(user: User): Entitlements {
  return resolveEntitlementsFromMetadata(user.app_metadata as Record<string, unknown>);
}

/**
 * MFA seam (coarse, sync). `enrolled` is hinted from tamper-proof app_metadata
 * so the session stays synchronous; the AUTHORITATIVE state (factors + AAL) is
 * resolved async via `getMfaStateAction` where a high-risk action must gate.
 */
function resolveMfaState(user: User): MfaState {
  const meta = user.app_metadata as Record<string, unknown> | undefined;
  return {
    enrolled: meta?.mfa_enrolled === true,
    required: meta?.mfa_required === true,
  };
}

/** Normalize a raw Supabase user into the app's `AuthenticatedUser`. */
function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email ?? null,
    emailVerified: Boolean(user.email_confirmed_at),
    entitlements: resolveEntitlements(user),
    mfa: resolveMfaState(user),
  };
}

/** The authenticated user, or `null`. Uses `getUser()` (verifies with Supabase). */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? toAuthenticatedUser(user) : null;
}

/** Raw session accessor when the token itself is needed (rare). */
export async function getSession() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * Require an authenticated user or redirect to login with a sanitized `next`.
 * Use in protected layouts and protected server actions.
 */
export async function requireAuth(returnTo?: string): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) {
    const next = sanitizeRedirect(returnTo, DEFAULT_AUTHED_REDIRECT);
    redirect(`${AUTH_ROUTES.login}?${NEXT_PARAM}=${encodeURIComponent(next)}`);
  }
  return user;
}

/**
 * Require a *verified* user (verification gate for sensitive actions). Redirects
 * unauthenticated users to login and unverified users to the verify page.
 */
export async function requireVerifiedUser(returnTo?: string): Promise<AuthenticatedUser> {
  const user = await requireAuth(returnTo);
  if (!user.emailVerified) {
    redirect(AUTH_ROUTES.verifyEmail);
  }
  return user;
}
