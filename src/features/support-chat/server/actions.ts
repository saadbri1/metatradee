'use server';

/**
 * Escalating a chat conversation to a human — SERVER ONLY.
 *
 * THIS ADDS NO NEW EMAIL PATH. It delegates to `submitSupportRequestAction`
 * from Phase 2, which owns the schema, the honeypot, the timing check, the rate
 * limit, the duplicate window, the sanitisation and the routing to
 * `COMPANY_EMAILS.support`. A second sender for the chatbot would be a second
 * place for those rules to drift, and the recipient decision in particular must
 * exist exactly once.
 *
 * WHAT IT DOES ADD is translation and one more redaction pass. The Phase 2
 * action answers in English prose; this maps its typed failure `code` onto the
 * visitor's language. And the message is redacted again here, on the server,
 * because the client-side pass is a convenience the server must never trust.
 *
 * THE HONEST FAILURE IS PRESERVED. Resend is still unconfigured, so today every
 * escalation returns `ok: false` with the fallback flag, and the panel shows the
 * real support address. Nothing here can report a success the transport did not
 * confirm — `ok` is copied from the Phase 2 result, never synthesised.
 */
import { submitSupportRequestAction } from '@/features/contact/server/actions';
import { redactSecrets } from '../redaction';
import { localiseFieldErrors } from '../schemas';
import { dictionaryFor } from '../translations';
import { DEFAULT_SUPPORT_CHAT_LOCALE, isSupportChatLocale } from '../types';

export interface ChatEscalationResult {
  /** True ONLY when the transport confirmed a send. */
  ok: boolean;
  /** Already translated. Safe to render. */
  message: string;
  /** Translated, keyed by field name. */
  fieldErrors?: Record<string, string>;
  /** Show the direct support address, because sending did not work. */
  showFallback?: boolean;
}

export async function submitChatEscalationAction(raw: unknown): Promise<ChatEscalationResult> {
  const input = (raw ?? {}) as Record<string, unknown>;
  const locale = isSupportChatLocale(input.locale) ? input.locale : DEFAULT_SUPPORT_CHAT_LOCALE;
  const t = dictionaryFor(locale);

  /*
   * `locale` is stripped rather than forwarded: `supportRequestSchema` does not
   * declare it, and the message is redacted again before the shared action sees
   * it. Client-side redaction is UX; this is the one that counts.
   */
  const { locale: _locale, ...payload } = input;
  const message = typeof payload.message === 'string' ? redactSecrets(payload.message).text : '';

  const result = await submitSupportRequestAction({ ...payload, message });

  if (result.ok) return { ok: true, message: t.escalation.success };

  if (result.code === 'validation') {
    return {
      ok: false,
      message: t.validation.generic,
      fieldErrors: localiseFieldErrors(result.fieldErrors, locale),
    };
  }

  /*
   * `blocked` and `send_failed` are shown the same way on purpose. The visitor
   * does not need to know which of our guards refused them — they need a
   * working address, which is what the fallback gives them. Telling a bot which
   * signal tripped is telling it how to pass next time.
   */
  return { ok: false, message: t.escalation.failure, showFallback: true };
}
