'use client';

/**
 * Conversation state for the chatbot.
 *
 * ONE HOOK OWNS THE WHOLE LIFECYCLE — turns, language, connectivity, the
 * in-flight request and its abort — because these are not independent. Closing
 * the panel must abort the request; going offline must stop a send rather than
 * queue a failure; switching language must not discard the conversation.
 * Splitting them across components is how a chat widget ends up firing a fetch
 * after unmount.
 *
 * THE WELCOME MESSAGE IS NOT A TURN. It is rendered from the dictionary, so
 * switching to Arabic mid-conversation re-renders it in Arabic instead of
 * leaving an English greeting stranded at the top of a right-to-left thread.
 * Real turns keep the language they were written in.
 *
 * NOTHING IS PERSISTED except the language choice. A support conversation can
 * contain an account email and a description of a problem; restoring it into a
 * shared browser later is not a feature anyone asked for.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { detectLocale } from './language-detection';
import { containsSecret } from './redaction';
import {
  DEFAULT_SUPPORT_CHAT_LOCALE,
  isSupportChatLocale,
  type ChatMessage,
  type ChatPhase,
  type ChatReply,
  type ChatView,
  type LocaleSource,
  type SupportChatLocale,
} from './types';

const ENDPOINT = '/api/support-chat';
/** Matches `MAX_CHAT_TURNS` on the server. Older turns are dropped from the send. */
const MAX_TURNS_SENT = 20;
const LOCALE_STORAGE_KEY = 'metatradee.support-chat.locale';
/**
 * Whether the stored language was CHOSEN or merely detected.
 *
 * Kept separate from the language itself so the two questions stay separable:
 * "which language" and "may we still change it for you". A single value could
 * not express "currently Arabic, because we guessed, and still willing to
 * revise" — which is exactly the state after a first Arabic message.
 */
const LOCALE_SOURCE_STORAGE_KEY = 'metatradee.support-chat.locale-source';

export interface SupportChatState {
  locale: SupportChatLocale;
  setLocale: (locale: SupportChatLocale) => void;
  /** Where the current language came from. `manual` disables detection. */
  localeSource: LocaleSource;
  messages: ChatMessage[];
  phase: ChatPhase;
  view: ChatView;
  setView: (view: ChatView) => void;
  /** True while a message the visitor typed looks like it contains a secret. */
  draftHasSecret: boolean;
  setDraft: (value: string) => void;
  draft: string;
  send: (text: string) => void;
  retry: () => void;
  /** Discards the conversation and returns to the greeting. */
  reset: () => void;
  /** True when the last assistant turn suggested talking to a person. */
  escalationSuggested: boolean;
  /**
   * Support category implied by the conversation, for preselecting the
   * escalation form. Null when nothing in the thread implies one.
   */
  suggestedCategory: string | null;
}

let turnCounter = 0;
/** Client-only ids. Not `crypto.randomUUID` — this must stay cheap and stable. */
function nextId(): string {
  turnCounter += 1;
  return `turn-${turnCounter}`;
}

export function useSupportChat(): SupportChatState {
  const [locale, setLocaleState] = useState<SupportChatLocale>(DEFAULT_SUPPORT_CHAT_LOCALE);
  const [localeSource, setLocaleSource] = useState<LocaleSource>('default');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<ChatPhase>('idle');
  const [view, setView] = useState<ChatView>('conversation');
  const [draft, setDraft] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  /** The turn that failed, so `retry` resends exactly it and not a stale draft. */
  const lastAttemptRef = useRef<string | null>(null);
  /**
   * Mirror of `messages` for the senders.
   *
   * `send` needs the history as it stood BEFORE the new turn. Reading it from
   * inside a `setMessages` updater would have worked, but a state updater must
   * be pure — React calls it twice in development Strict Mode, which would have
   * fired two requests for every message. The ref keeps the read outside.
   */
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /*
   * Restored AFTER mount, never during render. Reading localStorage while
   * rendering would make the server and client disagree and throw a hydration
   * error on every page the widget is mounted on — which is all of them.
   */
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      const source = window.localStorage.getItem(LOCALE_SOURCE_STORAGE_KEY);
      if (isSupportChatLocale(stored)) {
        setLocaleState(stored);
        setLocaleSource(source === 'manual' ? 'manual' : 'auto');
      }
    } catch {
      // Private mode or a blocked store: the default language is fine.
    }
  }, []);

  /** Persist the language and how we arrived at it. Never throws upward. */
  const rememberLocale = useCallback((next: SupportChatLocale, source: LocaleSource) => {
    setLocaleState(next);
    setLocaleSource(source);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      window.localStorage.setItem(LOCALE_SOURCE_STORAGE_KEY, source);
    } catch {
      // Not being able to remember the choice is not worth surfacing.
    }
  }, []);

  /**
   * The selector. Marks the choice as MANUAL, which permanently stops
   * detection — someone who has picked a language has answered the question,
   * and having the interface change back under them would be a bug they could
   * not work around.
   */
  const setLocale = useCallback(
    (next: SupportChatLocale) => rememberLocale(next, 'manual'),
    [rememberLocale],
  );

  /*
   * Connectivity. `navigator.onLine` is only reliable in the negative — a true
   * value does not prove reachability — so it is used to stop a doomed send and
   * to clear the offline state, never to claim the service is up.
   */
  useEffect(() => {
    const goOffline = () => setPhase('offline');
    const goOnline = () => setPhase((current) => (current === 'offline' ? 'idle' : current));
    if (typeof navigator !== 'undefined' && navigator.onLine === false) setPhase('offline');
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // Abort anything in flight when the widget goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = useCallback(
    async (text: string, history: ChatMessage[], askLocale: SupportChatLocale) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setPhase('sending');

      try {
        const response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            locale: askLocale,
            messages: [...history, { role: 'user' as const, content: text }]
              .slice(-MAX_TURNS_SENT)
              .map((m) => ({ role: m.role, content: m.content })),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          setPhase('error');
          return;
        }

        const reply = (await response.json()) as ChatReply;
        setMessages((current) => [
          ...current,
          {
            id: nextId(),
            role: 'assistant',
            content: reply.reply,
            at: Date.now(),
            locale: askLocale,
            source: reply.source,
            topicId: reply.topicId ?? undefined,
            suggestEscalation: reply.suggestEscalation,
            href: reply.href ?? undefined,
            category: reply.category ?? undefined,
          },
        ]);
        setPhase('idle');
        lastAttemptRef.current = null;
      } catch (err) {
        // An abort is a deliberate cancellation, not a failure to report.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setPhase('error');
      }
    },
    [],
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0 || phase === 'sending') return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setPhase('offline');
        return;
      }

      const history = messagesRef.current;

      /*
       * AUTOMATIC LANGUAGE DETECTION, on the first turn only, and only while
       * nobody has picked a language by hand.
       *
       * First turn only because that is where it helps and where it is safe: a
       * conversation that re-detected on every message would flip the interface
       * mid-thread on a one-word reply. `detectLocale` returns null when the
       * evidence is thin, and null means "leave it exactly as it is".
       *
       * The detected value is used for THIS request too, not just for the next
       * render — asking in Arabic and being answered in English because the
       * state update had not landed yet would defeat the whole point.
       */
      let askLocale = locale;
      if (localeSource !== 'manual' && history.length === 0) {
        const detected = detectLocale(trimmed);
        if (detected && detected !== locale) {
          askLocale = detected;
          rememberLocale(detected, 'auto');
        }
      }

      /*
       * THE MESSAGE TEXT IS NEVER REPORTED. A support message can contain an
       * account email, a broker name, or a description of someone's losses.
       * What travels is that a turn happened and in which language — enough to
       * measure engagement, useless for identifying anyone.
       */
      trackEvent('chat_message_sent', { locale: askLocale });

      const turn: ChatMessage = {
        id: nextId(),
        role: 'user',
        content: trimmed,
        at: Date.now(),
        locale: askLocale,
      };
      lastAttemptRef.current = trimmed;
      setDraft('');
      setMessages((current) => [...current, turn]);
      void ask(trimmed, history, askLocale);
    },
    [ask, locale, localeSource, phase, rememberLocale],
  );

  /**
   * Resend the turn that failed.
   *
   * The failed USER turn is already in `messages` — it was displayed, and
   * removing it would make the visitor's own words disappear on a network
   * blip. So the retry replays it against the history BEFORE it, which is what
   * the server would have seen the first time.
   */
  const retry = useCallback(() => {
    const text = lastAttemptRef.current;
    if (!text || phase === 'sending') return;
    const history = messagesRef.current.filter((m) => m.role !== 'user' || m.content !== text);
    void ask(text, history, locale);
  }, [ask, locale, phase]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    lastAttemptRef.current = null;
    setMessages([]);
    setDraft('');
    setPhase('idle');
    setView('conversation');
  }, []);

  const last = messages[messages.length - 1];

  /*
   * The most recent category the conversation implied. Walks BACKWARDS so a
   * later general question does not erase the billing dispute that prompted the
   * escalation in the first place.
   */
  const suggestedCategory =
    [...messages].reverse().find((m) => m.role === 'assistant' && m.category)?.category ?? null;

  return {
    locale,
    localeSource,
    setLocale,
    messages,
    phase,
    view,
    setView,
    draft,
    setDraft,
    draftHasSecret: draft.length > 0 && containsSecret(draft),
    send,
    retry,
    reset,
    escalationSuggested: last?.role === 'assistant' && last.suggestEscalation === true,
    suggestedCategory,
  };
}
