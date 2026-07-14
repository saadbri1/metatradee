/**
 * Auth configuration — pure constants only (no server/vendor imports) so this
 * module is safe to import from Edge middleware, server code, and client code.
 */
import type { OAuthProviderConfig } from './types';

/** Canonical auth route paths. Single source of truth for links + guards. */
export const AUTH_ROUTES = {
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  callback: '/auth/callback',
  confirm: '/auth/confirm',
  unauthorized: '/unauthorized',
  sessionExpired: '/session-expired',
} as const;

/** Where an authenticated user lands by default — the dashboard shell (9.5). */
export const DEFAULT_AUTHED_REDIRECT = '/dashboard';

/**
 * Path prefixes that require an authenticated session (middleware + guards).
 * All in-app shell routes are protected; the `(protected)` layout also guards
 * server-side (defense in depth).
 */
export const PROTECTED_PREFIXES = [
  '/account',
  '/dashboard',
  '/journal',
  '/analytics',
  '/calendar',
  '/playbook',
  '/goals',
  '/reports',
  '/ai-coach',
  '/settings',
  '/billing',
  '/help',
  '/onboarding',
] as const;

/**
 * Auth pages a signed-in user should be bounced away from. `reset-password` and
 * `verify-email` are deliberately excluded: password recovery arrives WITH a
 * (recovery) session, and a signed-in-but-unverified user must reach verify.
 */
export const AUTH_PAGES: readonly string[] = [
  AUTH_ROUTES.login,
  AUTH_ROUTES.register,
  AUTH_ROUTES.forgotPassword,
];

/** Query param carrying the post-auth return path. */
export const NEXT_PARAM = 'next';

/**
 * Provider-agnostic OAuth registry (SEAM). Adding a provider later = flip
 * `enabled` and wire it in the sign-in abstraction — no UI/flow refactor.
 * Nothing is enabled this phase.
 */
export const OAUTH_PROVIDERS: readonly OAuthProviderConfig[] = [
  { id: 'google', label: 'Google', enabled: false },
  { id: 'github', label: 'GitHub', enabled: false },
  { id: 'apple', label: 'Apple', enabled: false },
  { id: 'microsoft', label: 'Microsoft', enabled: false },
] as const;

/** Canonical audit event names (must match values logged server-side). */
export const AUDIT_EVENTS = {
  registered: 'auth.registered',
  loginSucceeded: 'auth.login.succeeded',
  loginFailed: 'auth.login.failed',
  loggedOut: 'auth.logout',
  passwordResetRequested: 'auth.password_reset.requested',
  passwordResetCompleted: 'auth.password_reset.completed',
  emailVerified: 'auth.email.verified',
  verificationResent: 'auth.email.verification_resent',
  sessionRevoked: 'auth.session.revoked',
  // Profile/workspace events (9.4) — same audit hook, extended catalog.
  profileUpdated: 'profile.updated',
  usernameChanged: 'profile.username.changed',
  avatarChanged: 'profile.avatar.changed',
  onboardingCompleted: 'profile.onboarding.completed',
  // Journal events (9.6) — same audit hook, extended catalog.
  tradeCreated: 'trade.created',
  tradeDeleted: 'trade.deleted',
  tradeRestored: 'trade.restored',
  tradeArchived: 'trade.archived',
  tradeBulk: 'trade.bulk',
  tradeVisibilityChanged: 'trade.visibility.changed',
  // Playbook/strategy events (9.10) — same audit hook, extended catalog.
  strategyCreated: 'strategy.created',
  strategyUpdated: 'strategy.updated',
  strategyVersioned: 'strategy.versioned',
  strategyStatusChanged: 'strategy.status.changed',
  strategyDeleted: 'strategy.deleted',
  // Enterprise auth events (9.2 enterprise additions) — MFA/RBAC/SSO.
  mfaEnrollStarted: 'mfa.enroll_started',
  mfaEnrolled: 'mfa.enrolled',
  mfaUnenrolled: 'mfa.unenrolled',
  roleChanged: 'rbac.role.changed',
  orgMemberAdded: 'org.member.added',
  ssoConnectionChanged: 'sso.connection.changed',
} as const;

export type AuditEvent = (typeof AUDIT_EVENTS)[keyof typeof AUDIT_EVENTS];

/**
 * Rate-limit / brute-force action keys (SEAM). Used at each sensitive entry
 * point so a limiter can be plugged in without touching call sites.
 */
export const RATE_LIMIT_ACTIONS = {
  register: 'register',
  login: 'login',
  forgotPassword: 'forgot_password',
  resetPassword: 'reset_password',
  resendVerification: 'resend_verification',
} as const;

export type RateLimitAction = (typeof RATE_LIMIT_ACTIONS)[keyof typeof RATE_LIMIT_ACTIONS];
