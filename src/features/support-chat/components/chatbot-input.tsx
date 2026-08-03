'use client';

/**
 * The composer.
 *
 * ENTER SENDS, SHIFT+ENTER ADDS A LINE. That is what people expect from a chat
 * box, and a textarea is used rather than an input so the second half of that
 * sentence is actually possible.
 *
 * THE PRIVACY WARNING IS ALWAYS VISIBLE, not a tooltip and not a one-time
 * notice. It sits directly under the field it applies to, because the moment
 * someone is about to paste an API key is the moment they are least likely to
 * go looking for a disclaimer.
 *
 * AND IT IS BACKED BY A CHECK. If what has been typed already looks like a
 * credential, the warning escalates in place before the message is sent — the
 * server redacts it either way, but not sending it at all is better.
 */
import type { KeyboardEvent } from 'react';
import { Send, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dictionaryFor } from '../translations';
import { LOCALE_DIRECTION, LOCALE_HTML_LANG, type SupportChatLocale } from '../types';

export function ChatbotInput({
  locale,
  value,
  onChange,
  onSend,
  busy,
  hasSecret,
}: {
  locale: SupportChatLocale;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  busy: boolean;
  hasSecret: boolean;
}) {
  const t = dictionaryFor(locale);
  const canSend = value.trim().length > 0 && !busy;

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSend) onSend();
    }
  }

  return (
    <div className="border-t border-border bg-card px-3 py-3">
      <div className="flex items-end gap-2">
        <label htmlFor="support-chat-input" className="sr-only">
          {t.inputLabel}
        </label>
        <textarea
          id="support-chat-input"
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t.inputPlaceholder}
          lang={LOCALE_HTML_LANG[locale]}
          dir={LOCALE_DIRECTION[locale]}
          aria-describedby="support-chat-privacy"
          className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          /* While busy the accessible name states WHY, rather than repeating "Send". */
          aria-label={busy ? t.loading : t.send}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors duration-fast hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 motion-reduce:transition-none"
        >
          <Send className="size-4 rtl:-scale-x-100" aria-hidden />
        </button>
      </div>

      <p
        id="support-chat-privacy"
        className={cn(
          'mt-2 flex items-start gap-1.5 text-xs leading-5',
          hasSecret ? 'font-medium text-destructive' : 'text-muted-foreground',
        )}
      >
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t.privacyWarning}
      </p>
    </div>
  );
}
