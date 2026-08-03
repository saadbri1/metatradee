/**
 * Resend transport — SERVER ONLY.
 *
 * Raw fetch against Resend's REST API rather than the SDK, matching how PayPal
 * is integrated in this repository: one typed client, no dependency, and the
 * request shape visible at the call site. `import 'server-only'` makes an
 * accidental client import a build error rather than a leaked API key.
 *
 * FAILS CLOSED AND SAYS SO. With no key configured it returns
 * `not_configured` — it does not pretend to have sent anything. That
 * distinction is the whole point of this module: the domain is not yet verified
 * in Resend, so today every send returns a typed failure, and the UI must show
 * the user a real fallback rather than a success message.
 */
import 'server-only';
import { emailFailure, type EmailResult } from './email-result';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
/** A hung provider call must not pin a serverless invocation open. */
const TIMEOUT_MS = 10_000;

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain text. No HTML is generated from user input anywhere in this path. */
  text: string;
  /** Where a human reply should go. */
  replyTo?: string;
}

export interface ResendConfig {
  apiKey: string;
  /** e.g. `MetaTradee Support <support@example.com>` */
  from: string;
}

/** Which required variables are absent. NAMES only, never values. */
export function missingEmailEnvKeys(): string[] {
  const missing: string[] = [];
  if (!process.env.RESEND_API_KEY) missing.push('RESEND_API_KEY');
  if (!process.env.SUPPORT_FROM_EMAIL) missing.push('SUPPORT_FROM_EMAIL');
  return missing;
}

export function isEmailConfigured(): boolean {
  return missingEmailEnvKeys().length === 0;
}

function config(): ResendConfig | null {
  if (!isEmailConfigured()) return null;
  return {
    apiKey: process.env.RESEND_API_KEY as string,
    from: process.env.SUPPORT_FROM_EMAIL as string,
  };
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const cfg = config();
  if (!cfg) {
    /*
     * Deliberately explicit. The caller must be able to tell "we could not
     * send" apart from "we sent", because the user-facing copy differs: one
     * offers a mailto fallback, the other says it is on its way.
     */
    return emailFailure(
      'not_configured',
      `Email transport is not configured. Missing: ${missingEmailEnvKeys().join(', ')}`,
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: cfg.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok) {
      /*
       * The provider body is NOT propagated. A 4xx from Resend can echo the
       * submitted address and content, and this string ends up in logs.
       */
      const reason = res.status >= 500 ? 'transport_error' : 'rejected';
      return emailFailure(reason, `Resend responded ${res.status}`);
    }

    const json = (await res.json().catch(() => ({}))) as { id?: string };
    if (!json.id) return emailFailure('transport_error', 'Resend returned no message id');
    return { ok: true, id: json.id };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return emailFailure(
      'transport_error',
      aborted ? 'Resend request timed out' : 'Resend request failed',
    );
  } finally {
    clearTimeout(timer);
  }
}
