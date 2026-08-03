/**
 * THE company email addresses. One definition, imported everywhere.
 *
 * Each address has a job, and using the wrong one is not a cosmetic mistake:
 * a billing dispute sent to `info` sits unread, and a sales lead sent to
 * `support` is lost. `PUBLIC_EMAIL_PURPOSE` below documents the routing so a
 * future call site picks by intent rather than by whichever address it
 * remembered.
 */

/**
 * Addresses that are safe to render in client-visible output.
 *
 * `admin` is deliberately NOT here. It is an internal operations mailbox, and a
 * separate export keeps it out of anything a component can import by accident.
 */
export const COMPANY_EMAILS = {
  /** Public general contact — contact page, footer, general inquiries. */
  contact: 'contact@metatradee.com',
  /** Company and partnership information, media requests. */
  info: 'info@metatradee.com',
  /** Pricing, subscriptions, upgrades, team and enterprise inquiries. */
  sales: 'sales@metatradee.com',
  /** Customer support — help, account, technical, billing assistance. */
  support: 'support@metatradee.com',
} as const;

export type PublicEmailKey = keyof typeof COMPANY_EMAILS;

/**
 * INTERNAL ONLY — the administrative mailbox.
 *
 * SERVER-SIDE USE ONLY: system notifications, internal configuration, operator
 * alerts. It must never appear in the footer, a contact page, landing copy, SEO
 * metadata, a client-facing email, or any bundle the browser downloads.
 *
 * It is exported separately, and NOT as part of COMPANY_EMAILS, precisely so
 * that "render every company email" — the natural shape of a contact block —
 * cannot pick it up. A test asserts it never appears in a client component.
 */
export const ADMIN_EMAIL = 'admin@metatradee.com' as const;

/**
 * Which address answers which intent. Reference for call sites; also the thing
 * to update if routing changes, rather than hunting `mailto:` strings.
 */
export const PUBLIC_EMAIL_PURPOSE: Record<PublicEmailKey, string> = {
  contact: 'General inquiries and the public contact form fallback.',
  info: 'Company information, partnerships and media.',
  sales: 'Pricing, subscriptions, upgrades, team and enterprise plans.',
  support: 'Account help, technical issues and billing assistance.',
};

/** `mailto:` for a public address, with an optional prefilled subject. */
export function mailto(key: PublicEmailKey, subject?: string): string {
  const address = COMPANY_EMAILS[key];
  return subject ? `mailto:${address}?subject=${encodeURIComponent(subject)}` : `mailto:${address}`;
}
