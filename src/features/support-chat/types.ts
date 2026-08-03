/**
 * Support-chat domain types.
 *
 * THE CHATBOT IS A SUPPORT SURFACE, NOT A MODEL WRAPPER. Every type here is
 * shaped around that: an answer carries the approved topic it came from, a
 * reply carries whether it was grounded, and escalation is a first-class state
 * rather than a link in a message. A shape that could not say "I have no
 * approved answer for this" would make an invented answer the path of least
 * resistance.
 *
 * SCOPE OF THE LANGUAGE SUPPORT: `SupportChatLocale` governs the chatbot and
 * nothing else. The surrounding site stays English — there is no global i18n
 * framework here, deliberately — so the direction flip below is applied to the
 * chatbot subtree only, never to `<html dir>`.
 */

export const SUPPORT_CHAT_LOCALES = ['en', 'fr', 'ar'] as const;
export type SupportChatLocale = (typeof SUPPORT_CHAT_LOCALES)[number];

export const DEFAULT_SUPPORT_CHAT_LOCALE: SupportChatLocale = 'en';

/**
 * Writing direction per locale.
 *
 * Applied as `dir` on the chatbot panel ONLY. Setting it on the document would
 * mirror the entire marketing site — header, footer, every page — for a user
 * who only asked the chat widget a question in Arabic.
 */
export const LOCALE_DIRECTION: Record<SupportChatLocale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  fr: 'ltr',
  ar: 'rtl',
};

/** BCP-47 tag for `lang`, so assistive tech announces each turn correctly. */
export const LOCALE_HTML_LANG: Record<SupportChatLocale, string> = {
  en: 'en',
  fr: 'fr',
  ar: 'ar',
};

export function isSupportChatLocale(value: unknown): value is SupportChatLocale {
  return typeof value === 'string' && (SUPPORT_CHAT_LOCALES as readonly string[]).includes(value);
}

export type ChatRole = 'user' | 'assistant';

/**
 * Where an assistant turn came from. Rendered as a small provenance line, and
 * asserted in tests: `knowledge` and `grounded_model` are the only sources
 * allowed to state a product fact.
 */
export type AnswerSource =
  /** Verbatim from the approved knowledge base. No model involved. */
  | 'knowledge'
  /** A model rephrased approved passages and passed the grounding check. */
  | 'grounded_model'
  /** No approved answer matched. States that, and offers a human. */
  | 'no_match'
  /** A safety rule replaced the content (secret sharing, advice request). */
  | 'guardrail';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** Epoch ms. Only used for ordering and keys — never emailed. */
  at: number;
  /** Locale the turn was written in, so a mixed-language thread reads right. */
  locale: SupportChatLocale;
  /** Assistant turns only. */
  source?: AnswerSource;
  /** Assistant turns only — the approved topic that answered. */
  topicId?: string;
  /** Assistant turns only — true when a human would serve the user better. */
  suggestEscalation?: boolean;
  /** Assistant turns only — a real public route to read more. */
  href?: string;
}

/** What the conversation is doing right now. */
export type ChatPhase =
  | 'idle'
  /** Waiting on the server. */
  | 'sending'
  /** The last send failed and can be retried. */
  | 'error'
  /** The browser reports no connection. */
  | 'offline';

/** Which pane the panel body is showing. */
export type ChatView = 'conversation' | 'escalation';

/** The escalation form's own lifecycle, separate from the conversation's. */
export type EscalationPhase = 'form' | 'sending' | 'sent' | 'failed';

/** Wire shape returned by `POST /api/support-chat`. */
export interface ChatReply {
  reply: string;
  source: AnswerSource;
  topicId: string | null;
  suggestEscalation: boolean;
  /** A real public route, or null. Never a fabricated link. */
  href: string | null;
}
