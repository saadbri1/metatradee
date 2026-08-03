'use client';

/**
 * The transcript.
 *
 * ANNOUNCED, NOT JUST DRAWN. The list is a `role="log"` with `aria-live`, so a
 * screen-reader user hears each reply as it lands instead of having to go
 * hunting for it — a chat widget that only works visually is a chat widget half
 * the point of which is missing.
 *
 * EVERY TURN CARRIES ITS OWN `lang` AND `dir`. A conversation can legitimately
 * mix languages: someone asks in Arabic, switches to English, and both bubbles
 * must read correctly. Tagging each bubble rather than the container is what
 * makes that work, and it is what tells a screen reader which voice to use.
 *
 * The scroll follow respects `prefers-reduced-motion` — an auto-scrolling
 * container is exactly the kind of unrequested movement that rule exists for.
 */
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Bot, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dictionaryFor } from '../translations';
import {
  LOCALE_DIRECTION,
  LOCALE_HTML_LANG,
  type ChatMessage,
  type ChatPhase,
  type SupportChatLocale,
} from '../types';

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const t = dictionaryFor(message.locale);

  return (
    <li
      className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
      lang={LOCALE_HTML_LANG[message.locale]}
      dir={LOCALE_DIRECTION[message.locale]}
    >
      <div className="max-w-[85%]">
        <p className="sr-only">{isUser ? t.messages.you : t.assistantName}</p>
        <div
          className={cn(
            'whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-6',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'border border-border bg-card text-foreground',
          )}
        >
          {message.content}
        </div>
        {message.href ? (
          <Link
            href={message.href}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            {message.href}
            <ArrowRight className="size-3 rtl:rotate-180" aria-hidden />
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export function ChatbotMessages({
  locale,
  messages,
  phase,
  onRetry,
}: {
  locale: SupportChatLocale;
  messages: ChatMessage[];
  phase: ChatPhase;
  onRetry: () => void;
}) {
  const t = dictionaryFor(locale);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    endRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'end' });
  }, [messages.length, phase]);

  return (
    <div className="flex flex-col gap-3">
      {/* The greeting is rendered, not stored, so it follows the language. */}
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="size-4" aria-hidden />
        </span>
        <p className="rounded-2xl border border-border bg-card px-3.5 py-2.5 text-sm leading-6 text-foreground">
          {t.welcome}
        </p>
      </div>

      {/*
       * `role="log"` goes on the WRAPPER, not on the `<ul>`. An element with an
       * overridden role stops being a list, which would leave its `<li>`
       * children orphaned — the turns are a list AND the region is a log, so
       * they need to be two elements.
       */}
      <div role="log" aria-live="polite" aria-relevant="additions" aria-label={t.messages.log}>
        <ul className="flex flex-col gap-3">
          {messages.map((message) => (
            <Bubble key={message.id} message={message} />
          ))}
        </ul>
      </div>

      {phase === 'sending' ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <span className="flex gap-1" aria-hidden>
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="size-1.5 animate-pulse rounded-full bg-muted-foreground/60 motion-reduce:animate-none"
                style={{ animationDelay: `${dot * 140}ms` }}
              />
            ))}
          </span>
          {t.typing}
        </p>
      ) : null}

      {phase === 'error' || phase === 'offline' ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-foreground"
        >
          <span className="flex items-center gap-1.5 font-medium text-destructive">
            {phase === 'offline' ? (
              <WifiOff className="size-3.5" aria-hidden />
            ) : (
              <AlertCircle className="size-3.5" aria-hidden />
            )}
            {phase === 'offline' ? t.offline : t.error}
          </span>
          {phase === 'error' ? (
            <button
              type="button"
              onClick={onRetry}
              className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t.retry}
            </button>
          ) : null}
        </div>
      ) : null}

      <div ref={endRef} />
    </div>
  );
}
