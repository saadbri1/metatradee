/**
 * Enterprise SSO/SAML scaffolding (documented seam — not a live IdP integration).
 *
 * Supabase supports SSO via SAML 2.0: an org admin registers an IdP (metadata
 * URL/XML) keyed to an email domain; users at that domain are redirected to their
 * IdP. This module models the config + domain→connection resolution so the app
 * can route a login to SSO. The actual `signInWithSSO`/ACS handshake is
 * PROVIDER-HOSTED and pending-live (needs a configured IdP + Supabase project).
 */

export interface SsoConnection {
  organizationId: string;
  provider: 'saml';
  /** Email domain that triggers SSO, e.g. "acme.com". */
  domain: string;
  isActive: boolean;
}

/** Extract the domain from an email (lowercased), or null. */
export function domainOf(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

/** Find an active SSO connection for an email's domain, if any (enforced login). */
export function ssoConnectionForEmail(
  email: string,
  connections: SsoConnection[],
): SsoConnection | null {
  const domain = domainOf(email);
  if (!domain) return null;
  return connections.find((c) => c.isActive && c.domain === domain) ?? null;
}
