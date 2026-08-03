/**
 * Public surface of the support chatbot.
 *
 * Pages mount `SupportChat` and nothing else. The server pieces —
 * `server/answer.ts` and `server/actions.ts` — are deliberately NOT re-exported
 * here: this barrel is imported by client components, and pulling a
 * `server-only` module into it would turn an accidental import into a build
 * error for the whole feature rather than for the one file at fault.
 */
export { SupportChat } from './components/support-chat';
export {
  SUPPORT_CHAT_LOCALES,
  DEFAULT_SUPPORT_CHAT_LOCALE,
  LOCALE_DIRECTION,
  isSupportChatLocale,
  type SupportChatLocale,
  type ChatMessage,
  type ChatReply,
} from './types';
export { SUPPORT_CHAT_TRANSLATIONS, dictionaryFor } from './translations';
export { KNOWLEDGE_TOPICS, findTopic, normalizeForMatch } from './knowledge';
export { redactSecrets, containsSecret } from './redaction';
