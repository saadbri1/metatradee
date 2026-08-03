'use client';

/**
 * The chatbot panel.
 *
 * RIGHT-TO-LEFT IS SCOPED TO THIS ELEMENT. `dir` is set on the panel root, so
 * choosing Arabic mirrors the chat and nothing else — the header, the page and
 * the footer behind it stay exactly as they were. Flipping `<html dir>` for a
 * widget preference would re-lay-out an entire English marketing site around a
 * question someone asked in a 400-pixel box.
 *
 * NON-MODAL BY DESIGN. `aria-modal` is false and there is no focus trap: this
 * is a helper attached to a page people are still reading, and locking the page
 * behind it would make "let me check the pricing page while I ask" impossible.
 * Escape still closes it and returns focus to the launcher, which is the part
 * of dialog behaviour that genuinely applies here.
 *
 * ESCALATION IS ALWAYS ONE CONTROL AWAY. The route to a human does not depend
 * on the assistant having offered it — it is emphasised when the assistant
 * suggests it, and present regardless.
 */
import { useEffect, useRef } from 'react';
import { Bot, LifeBuoy, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatbotInput } from './chatbot-input';
import { ChatbotLanguageSelector } from './chatbot-language-selector';
import { ChatbotMessages } from './chatbot-messages';
import { ChatbotQuickActions } from './chatbot-quick-actions';
import { ChatbotSupportForm } from './chatbot-support-form';
import { dictionaryFor } from '../translations';
import { LOCALE_DIRECTION, LOCALE_HTML_LANG } from '../types';
import type { SupportChatState } from '../use-support-chat';

export function ChatbotPanel({
  chat,
  onClose,
  labelledBy,
}: {
  chat: SupportChatState;
  onClose: () => void;
  labelledBy: string;
}) {
  const t = dictionaryFor(chat.locale);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus the composer on open so the panel is usable without reaching for a
  // mouse; falls back to the panel itself when the escalation form is showing.
  useEffect(() => {
    const field = panelRef.current?.querySelector<HTMLElement>('#support-chat-input');
    (field ?? panelRef.current)?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-labelledby={labelledBy}
      dir={LOCALE_DIRECTION[chat.locale]}
      lang={LOCALE_HTML_LANG[chat.locale]}
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-raised outline-none',
        // Phone: a sheet with room for the launcher. Tablet and up: a panel.
        'fixed inset-x-3 bottom-[5.5rem] top-4 z-[60]',
        'sm:inset-auto sm:bottom-24 sm:end-6 sm:top-auto sm:h-[min(38rem,calc(100vh-9rem))] sm:w-[24rem]',
      )}
    >
      <header className="flex items-start gap-3 bg-primary px-4 py-3.5 text-primary-foreground">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
          <Bot className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p id={labelledBy} className="truncate text-sm font-semibold">
            {t.assistantName}
          </p>
          <p className="mt-0.5 text-xs leading-4 text-primary-foreground/75">{t.availability}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ChatbotLanguageSelector locale={chat.locale} onChange={chat.setLocale} />
          <button
            type="button"
            onClick={onClose}
            aria-label={t.launcher.close}
            className="flex size-8 items-center justify-center rounded-lg text-primary-foreground/80 transition-colors duration-fast hover:bg-primary-foreground/15 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground motion-reduce:transition-none"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {chat.view === 'escalation' ? (
          <ChatbotSupportForm
            locale={chat.locale}
            messages={chat.messages}
            onBack={() => chat.setView('conversation')}
          />
        ) : (
          <div className="p-4">
            <p className="mb-3 text-xs leading-5 text-muted-foreground">{t.disclosure}</p>
            <ChatbotMessages
              locale={chat.locale}
              messages={chat.messages}
              phase={chat.phase}
              onRetry={chat.retry}
            />
            {chat.messages.length === 0 ? (
              <ChatbotQuickActions
                locale={chat.locale}
                onSelect={chat.send}
                disabled={chat.phase === 'sending'}
              />
            ) : null}
          </div>
        )}
      </div>

      {chat.view === 'conversation' ? (
        <>
          <div className="border-t border-border bg-muted/30 px-3 py-2">
            <button
              type="button"
              onClick={() => chat.setView('escalation')}
              className={cn(
                'inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                chat.escalationSuggested
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'border border-border bg-card text-foreground hover:bg-accent',
              )}
            >
              <LifeBuoy className="size-3.5" aria-hidden />
              {t.escalation.open}
            </button>
          </div>
          <ChatbotInput
            locale={chat.locale}
            value={chat.draft}
            onChange={chat.setDraft}
            onSend={() => chat.send(chat.draft)}
            busy={chat.phase === 'sending'}
            hasSecret={chat.draftHasSecret}
          />
        </>
      ) : null}
    </div>
  );
}
