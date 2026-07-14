/**
 * Auth domain types and future-ready seams. No runtime imports — safe anywhere.
 */

/**
 * Every sign-in method the architecture anticipates. Only `email` is implemented
 * this phase; the rest are declared so the sign-in abstraction and UI can be
 * extended without changing this contract.
 */
export type AuthProviderId =
  | 'email'
  | 'google'
  | 'github'
  | 'apple'
  | 'microsoft'
  | 'magiclink'
  | 'passkey' // WebAuthn seam
  | 'saml' // enterprise SSO seam
  | 'oidc'; // enterprise SSO seam

/** OAuth provider registry entry (see config.OAUTH_PROVIDERS). */
export interface OAuthProviderConfig {
  id: Extract<AuthProviderId, 'google' | 'github' | 'apple' | 'microsoft'>;
  label: string;
  enabled: boolean;
}

/**
 * RBAC seam. Auth utilities resolve entitlements to a single place; today it
 * always returns the default role, but org/role/permission resolution slots in
 * here later without touching guards or pages.
 */
export type Role = 'member' | 'admin' | 'owner';

export interface Entitlements {
  role: Role;
  /** Fine-grained permission slugs; empty until RBAC lands. */
  permissions: readonly string[];
  /** Active organization id; null until Organizations lands. */
  organizationId: string | null;
}

/** MFA seam — surfaced by the session so high-risk actions can gate on it later. */
export interface MfaState {
  enrolled: boolean;
  required: boolean;
}

/** The normalized authenticated user the app consumes (never the raw SDK user). */
export interface AuthenticatedUser {
  id: string;
  email: string | null;
  emailVerified: boolean;
  entitlements: Entitlements;
  mfa: MfaState;
}

/**
 * Discriminated result returned by auth server actions. `fieldErrors` maps a
 * form field to its messages so the client can show inline validation without a
 * second schema.
 */
export type AuthActionResult =
  | { ok: true; redirectTo?: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };
