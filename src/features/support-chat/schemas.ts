/**
 * Chat and escalation payload validation.
 *
 * TWO SCHEMAS FOR TWO JOBS, and neither replaces the other:
 *
 *   `chatRequestSchema` guards the chat endpoint. Every bound here exists
 *   because the endpoint may reach a paid model: a 200-turn conversation of
 *   10 kB messages is a bill, not a support question.
 *
 *   `escalationSchema(locale)` is a CLIENT-SIDE schema whose messages are
 *   translated. It is a UX layer only — the server still validates the same
 *   submission with `supportRequestSchema` from Phase 2, which is the one that
 *   actually decides what gets sent. Localising the server schema instead would
 *   have meant trusting a client-supplied locale to pick error text on a path
 *   that also decides whether to send mail.
 */
import { z } from 'zod';
import { SUPPORT_CHAT_LOCALES, type SupportChatLocale } from './types';
import { dictionaryFor } from './translations';
import { SUPPORT_CATEGORIES } from '@/features/contact/schemas';

/** A single turn on the wire. */
export const chatTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(1_000),
});

/** Longest history the endpoint will consider. Older turns are the client's problem. */
export const MAX_CHAT_TURNS = 20;

export const chatRequestSchema = z.object({
  locale: z.enum(SUPPORT_CHAT_LOCALES),
  /** Oldest first. The last turn must be the user's, or there is nothing to answer. */
  messages: z.array(chatTurnSchema).min(1).max(MAX_CHAT_TURNS),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;

/**
 * The escalation form, validated in the visitor's language.
 *
 * Bounds are deliberately IDENTICAL to `supportRequestSchema` so a submission
 * that passes here cannot then fail server-side with an untranslated message —
 * a form that rejects in French and then rejects again in English reads as a
 * broken form.
 */
export function escalationSchema(locale: SupportChatLocale) {
  const t = dictionaryFor(locale).validation;
  return z.object({
    name: z.string().trim().min(1, t.name).max(80),
    email: z.string().trim().toLowerCase().email(t.email).max(160),
    subject: z.string().trim().min(3, t.subject).max(140),
    category: z.enum(SUPPORT_CATEGORIES),
    message: z.string().trim().min(20, t.message).max(4_000),
    consent: z.literal(true, { errorMap: () => ({ message: t.consent }) }),
  });
}

export type EscalationInput = z.infer<ReturnType<typeof escalationSchema>>;

/**
 * Server field errors, translated for display.
 *
 * The Phase 2 action returns English `fieldErrors` keyed by field name. Rather
 * than render those to a French or Arabic speaker, the KEY is used to look up
 * the local message; an unrecognised key falls back to the generic line rather
 * than leaking English into an Arabic panel.
 */
export function localiseFieldErrors(
  fieldErrors: Record<string, string> | undefined,
  locale: SupportChatLocale,
): Record<string, string> {
  if (!fieldErrors) return {};
  const t = dictionaryFor(locale).validation;
  const known: Record<string, string> = {
    name: t.name,
    email: t.email,
    subject: t.subject,
    message: t.message,
    consent: t.consent,
  };
  const out: Record<string, string> = {};
  for (const key of Object.keys(fieldErrors)) out[key] = known[key] ?? t.generic;
  return out;
}
