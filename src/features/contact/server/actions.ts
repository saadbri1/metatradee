'use server';

/**
 * Contact and support submissions.
 *
 * ORDER MATTERS and is cheapest-first: schema, then bot signals, then send. A
 * bot must never cost a provider call, and an oversized payload must never
 * reach the sanitiser.
 *
 * NO FAKE SUCCESS. The transport is not configured yet — the domain is not
 * verified in Resend — so today every submission returns `ok: false` with
 * `not_configured`, and the form shows a real mailto fallback. That is the
 * whole reason `EmailResult` is a discriminated union rather than a boolean:
 * "we could not send" and "we sent" must be impossible to confuse.
 */
import { headers } from 'next/headers';
import { COMPANY_EMAILS } from '@/config/contact';
import {
  sendAcknowledgement,
  sendContactRequest,
  sendSupportRequest,
} from '@/server/email/send-contact-request';
import { BOT_MESSAGE, RATE_LIMIT, verdict } from '../bot-protection';
import { contactRequestSchema, supportRequestSchema } from '../schemas';

/**
 * WHY A CODE AS WELL AS A MESSAGE: `message` is English prose written for the
 * /contact and /support pages. The support chatbot renders in three languages
 * and cannot show it, so it branches on this closed set and supplies its own
 * copy. Additive — the existing forms ignore it and are unchanged.
 */
export type SubmitFailureCode =
  /** Schema rejected the payload; see `fieldErrors`. */
  | 'validation'
  /** A bot-protection signal tripped. Deliberately not more specific. */
  | 'blocked'
  /** Everything passed, but the transport could not send. */
  | 'send_failed';

export interface SubmitResult {
  ok: boolean;
  /** Safe to render. Never a provider or database message. */
  message: string;
  /** Present on every failure. Absent on success. */
  code?: SubmitFailureCode;
  /** Field-level validation errors, keyed by field name. */
  fieldErrors?: Record<string, string>;
  /**
   * True when the message could not be sent for an operational reason. The UI
   * shows the mailto fallback so the user is not simply stuck.
   */
  showFallback?: boolean;
}

/**
 * In-memory rate limit and duplicate window.
 *
 * DELIBERATELY MODEST: a serverless instance does not share this, so it throttles
 * a burst from one origin rather than guaranteeing a global cap. It is the
 * cheap first line — the honeypot and timing checks do the heavier lifting, and
 * a shared store (or Turnstile, which this stays adapter-friendly for) is the
 * upgrade path when there is traffic to justify it.
 */
const submissions = new Map<string, number[]>();
const recentPayloads = new Map<string, number>();

function prune(now: number) {
  for (const [key, times] of submissions) {
    const kept = times.filter((t) => now - t < RATE_LIMIT.windowMs);
    if (kept.length) submissions.set(key, kept);
    else submissions.delete(key);
  }
  for (const [key, at] of recentPayloads) {
    if (now - at > RATE_LIMIT.windowMs) recentPayloads.delete(key);
  }
}

/** Coarse origin key. Never emailed or persisted — only counted. */
async function originKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
}

async function requestContext() {
  const h = await headers();
  return {
    pageUrl: h.get('referer') ?? undefined,
    userAgent: h.get('user-agent') ?? undefined,
  };
}

/** Stable fingerprint of the content, for duplicate detection. */
function payloadKey(origin: string, email: string, message: string): string {
  return `${origin}|${email}|${message.slice(0, 200)}`;
}

const GENERIC_FAILURE =
  'We could not send that message just now. Please email us directly — the address is below.';

/**
 * Shared guard + send. The SENDER is passed in already bound to its own parsed,
 * typed payload, so the two flows share every check without this function
 * having to cast between two different payload shapes — the previous version
 * needed a `never` cast to compile, which is exactly the kind of assertion that
 * hides a real mismatch later.
 */
async function guardAndSend<
  T extends {
    email: string;
    message: string;
    subject: string;
    company: string;
    renderedAt: number;
  },
>(
  kind: 'contact' | 'support',
  parsed:
    | { success: true; data: T }
    | { success: false; error: { issues: { path: (string | number)[]; message: string }[] } },
  send: (
    data: T,
    ctx: { pageUrl?: string; userAgent?: string },
  ) => Promise<{ ok: boolean; reason?: string; detail?: string }>,
): Promise<SubmitResult> {
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      code: 'validation',
      message: 'Please check the highlighted fields.',
      fieldErrors,
    };
  }

  const data = parsed.data;
  const now = Date.now();
  prune(now);

  const origin = await originKey();
  const key = payloadKey(origin, data.email, data.message);
  const times = submissions.get(origin) ?? [];

  const check = verdict({
    honeypot: data.company,
    renderedAt: data.renderedAt,
    now,
    recentSubmissions: times.length,
    isDuplicate: recentPayloads.has(key),
  });
  if (!check.allowed) {
    /*
     * A bot is told nothing specific. Naming the tripped signal is telling it
     * how to pass next time, so honeypot and timing share one generic line.
     */
    return { ok: false, code: 'blocked', message: BOT_MESSAGE[check.reason] };
  }

  const ctx = await requestContext();
  const result = await send(data, ctx);

  if (!result.ok) {
    // Reason is logged, never shown — it can carry provider detail.
    console.error(`[contact] send failed (${kind}): ${result.reason} — ${result.detail}`);
    return { ok: false, code: 'send_failed', message: GENERIC_FAILURE, showFallback: true };
  }

  // Only count a submission that actually went somewhere.
  submissions.set(origin, [...times, now]);
  recentPayloads.set(key, now);

  /*
   * The receipt is best-effort. If the request landed but the acknowledgement
   * bounced, the user has still been heard — reporting failure there would be
   * wrong, and would invite a duplicate submission.
   */
  void sendAcknowledgement(
    data.email,
    data.subject,
    kind === 'support' ? COMPANY_EMAILS.support : COMPANY_EMAILS.contact,
  ).catch(() => undefined);

  return {
    ok: true,
    message: 'Thanks — your message is on its way. We have sent a copy to your email address.',
  };
}

export async function submitContactRequestAction(raw: unknown): Promise<SubmitResult> {
  return guardAndSend('contact', contactRequestSchema.safeParse(raw), (data, ctx) =>
    sendContactRequest(data, ctx),
  );
}

export async function submitSupportRequestAction(raw: unknown): Promise<SubmitResult> {
  return guardAndSend('support', supportRequestSchema.safeParse(raw), (data, ctx) =>
    sendSupportRequest(data, ctx),
  );
}
