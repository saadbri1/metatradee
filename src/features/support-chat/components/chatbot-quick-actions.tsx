'use client';

/**
 * The seeded openers.
 *
 * A blank chat box is a worse prompt than four buttons. These exist so a
 * visitor who does not know what the assistant covers can find out in one
 * click, and every one of them maps to an approved knowledge topic — a quick
 * action that led to "I do not have an answer for that" would be a trap.
 *
 * Shown only while the conversation is empty. Leaving them under a live thread
 * competes with the composer for the same attention.
 */
import { dictionaryFor } from '../translations';
import type { SupportChatLocale } from '../types';

export function ChatbotQuickActions({
  locale,
  onSelect,
  disabled,
}: {
  locale: SupportChatLocale;
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}) {
  const t = dictionaryFor(locale);

  return (
    <div className="mt-4">
      <p className="text-label font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {t.quickActionsLabel}
      </p>
      <ul className="mt-2.5 flex flex-wrap gap-2">
        {t.quickActions.map((action) => (
          <li key={action.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(action.prompt)}
              className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-foreground transition-colors duration-fast hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none"
            >
              {action.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
