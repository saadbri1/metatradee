'use server';

/**
 * Remembering which address a verification link was sent to — SERVER ONLY.
 *
 * WHY THIS IS A COOKIE AND NOT A QUERY PARAMETER.
 *
 * The verify-email screen has to say *which* address to go and check, or it is
 * useless to anyone with more than one mailbox. The obvious way to carry it —
 * `/verify-email?email=…` — puts a personal identifier into the browser's
 * history, into the `Referer` header of every subsequent request, into server
 * and CDN access logs, and into any analytics that records a path. That is the
 * definition of exposing it publicly, and it is exactly what the brief forbids.
 *
 * An `httpOnly` cookie is read by the server component that renders the page
 * and by nothing else: not client JavaScript, not a URL, not a log line, not a
 * referrer. It is short-lived because it is a UI hint rather than state, and it
 * is cleared the moment the address is confirmed.
 *
 * IT IS NOT AN AUTHENTICATION SIGNAL. Nothing trusts this cookie for identity —
 * a forged one would change a sentence on a page and grant nothing. The session
 * remains the only thing that authenticates anybody.
 */
import { cookies } from 'next/headers';

const COOKIE = 'mt_pending_verification';
/** Long enough to read the sentence and check a mailbox; short enough to lapse. */
const MAX_AGE_SECONDS = 30 * 60;

export async function setPendingVerificationEmail(email: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getPendingVerificationEmail(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(COOKIE)?.value;
  if (!value) return null;
  /*
   * Shape-checked before it is rendered. The cookie is client-supplied — an
   * attacker can set their own — so this must not become a way to put chosen
   * text on our page. React escapes it anyway; this keeps it plausible too.
   */
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) && value.length <= 160 ? value : null;
}

export async function clearPendingVerificationEmail(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
