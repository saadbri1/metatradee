/**
 * Turning a conversation into a support email body.
 *
 * THE POINT OF ATTACHING THE TRANSCRIPT is that a person escalating from chat
 * has already explained themselves once. Making them retype it is the most
 * common way a chat-to-human handover wastes everyone's time.
 *
 * TWO CONSTRAINTS SHAPE EVERY LINE HERE:
 *
 *   THE CAP IS REAL. `supportRequestSchema` bounds the message at 4 000
 *   characters, so a long conversation must be trimmed BEFORE it is submitted,
 *   not rejected after. Trimming drops the OLDEST turns, because the newest
 *   ones are the reason the person is escalating.
 *
 *   THE TRANSCRIPT IS REDACTED. It is user-typed text on its way into an inbox
 *   and a mail provider's logs, so it goes through `redactSecrets` first. The
 *   server redacts again on receipt — this is not the only line of defence,
 *   just the earliest one.
 */
import { redactSecrets } from './redaction';
import { dictionaryFor } from './translations';
import type { ChatMessage, SupportChatLocale } from './types';

/** Matches the `message` bound in `supportRequestSchema`. */
export const MAX_MESSAGE_LENGTH = 4_000;

/** Kept clear of the cap so trimming never produces an off-by-one rejection. */
const SAFETY_MARGIN = 64;

export interface EscalationMessageInput {
  /** What the person typed into the escalation form. Never trimmed away. */
  description: string;
  messages: ChatMessage[];
  locale: SupportChatLocale;
  /** False when the person unticked "include this conversation". */
  includeTranscript: boolean;
}

/** One turn, attributed. Uses the display names from the chosen language. */
function formatTurn(message: ChatMessage, locale: SupportChatLocale): string {
  const t = dictionaryFor(locale);
  const who = message.role === 'user' ? t.messages.you : t.assistantName;
  return `${who}: ${redactSecrets(message.content).text}`;
}

/**
 * Compose the email body.
 *
 * The person's own description always survives in full; only the transcript is
 * trimmed, oldest turn first, and the reader is told when that happened rather
 * than being handed a conversation that silently starts mid-sentence.
 */
export function buildEscalationMessage(input: EscalationMessageInput): string {
  const t = dictionaryFor(input.locale);
  const description = redactSecrets(input.description).text.trim();

  if (!input.includeTranscript || input.messages.length === 0) {
    return description.slice(0, MAX_MESSAGE_LENGTH);
  }

  const header = `\n\n--- ${t.escalation.transcriptHeading} ---\n`;
  const budget = MAX_MESSAGE_LENGTH - SAFETY_MARGIN - description.length - header.length;

  // No room for even a token amount of history: send the description alone.
  if (budget <= 0) return description.slice(0, MAX_MESSAGE_LENGTH);

  const turns: string[] = [];
  let used = 0;
  let dropped = 0;

  // Newest first while filling, so the oldest turns are the ones dropped.
  for (let i = input.messages.length - 1; i >= 0; i--) {
    const message = input.messages[i];
    if (!message) continue;
    const line = formatTurn(message, input.locale);
    if (used + line.length + 1 > budget) {
      dropped = i + 1;
      break;
    }
    turns.unshift(line);
    used += line.length + 1;
  }

  const body = [description, header.trimEnd(), ...turns].join('\n');
  const notice =
    dropped > 0 ? `\n${t.escalation.transcriptTrimmed.replace('{count}', String(dropped))}` : '';
  return `${body}${notice}`.slice(0, MAX_MESSAGE_LENGTH);
}
