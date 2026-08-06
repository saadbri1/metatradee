'use client';

/**
 * Language control for the chatbot.
 *
 * A NATIVE SELECT, deliberately. It is the same control the contact form uses,
 * it is keyboard- and screen-reader-correct without a line of custom code, and
 * on a phone it opens the platform picker instead of a cramped popover inside
 * an already-floating panel.
 *
 * THE OPTION LABELS ARE NEVER TRANSLATED. "Français" is written the same way
 * whichever language the interface is in — a French speaker looking for their
 * language should not have to recognise the word "French" in Arabic first.
 */
import { Languages } from 'lucide-react';
import { LOCALE_OPTIONS, dictionaryFor } from '../translations';
import type { SupportChatLocale } from '../types';

export function ChatbotLanguageSelector({
  locale,
  onChange,
  id = 'support-chat-language',
}: {
  locale: SupportChatLocale;
  onChange: (locale: SupportChatLocale) => void;
  id?: string;
}) {
  const t = dictionaryFor(locale);

  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={id} className="sr-only">
        {t.languageSelector.label}
      </label>
      <Languages className="size-3.5 shrink-0 text-primary-foreground/70" aria-hidden />
      <select
        id={id}
        value={locale}
        onChange={(event) => onChange(event.target.value as SupportChatLocale)}
        className="h-11 cursor-pointer rounded-md border border-primary-foreground/25 bg-transparent py-1 pe-1 ps-2 text-xs font-medium text-primary-foreground outline-none transition-colors duration-fast hover:border-primary-foreground/50 focus-visible:ring-1 focus-visible:ring-primary-foreground motion-reduce:transition-none"
      >
        {LOCALE_OPTIONS.map((option) => (
          // The option list renders in the browser's own chrome, which does not
          // inherit the panel's colours — so it is left to the platform.
          <option key={option.value} value={option.value} className="text-foreground">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
