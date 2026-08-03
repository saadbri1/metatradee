'use client';

/**
 * The floating launcher.
 *
 * ANCHORED BOTTOM-RIGHT IN EVERY LANGUAGE. The button deliberately does NOT
 * mirror with the chatbot's direction: the page around it is left-to-right, the
 * launcher belongs to the page rather than to the conversation, and moving it
 * across the viewport when someone picks Arabic would relocate a control they
 * had already found. Direction is flipped inside the panel, where the content
 * actually is.
 *
 * IT IS A DISCLOSURE BUTTON, not a decoration: `aria-expanded` and
 * `aria-controls` tie it to the panel, so assistive tech reports the state
 * rather than announcing an unlabelled circle.
 */
import { MessageCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dictionaryFor } from '../translations';
import type { SupportChatLocale } from '../types';

export function ChatbotLauncher({
  locale,
  open,
  onToggle,
  controls,
  buttonRef,
}: {
  locale: SupportChatLocale;
  open: boolean;
  onToggle: () => void;
  controls: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  const t = dictionaryFor(locale);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={open ? t.launcher.close : t.launcher.open}
      className={cn(
        'fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-raised',
        'h-12 px-4 sm:h-14 sm:px-5',
        'transition-transform duration-normal ease-emphasized hover:scale-[1.03] active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        // Transform-only motion, and none at all when reduced motion is asked for.
        'motion-reduce:transform-none motion-reduce:transition-none',
      )}
    >
      {open ? (
        <X className="size-5" aria-hidden />
      ) : (
        <MessageCircle className="size-5" aria-hidden />
      )}
      {/* The label is decorative for assistive tech — `aria-label` above is the
          accessible name, and repeating it here would announce it twice. */}
      <span aria-hidden className="hidden text-sm font-medium sm:inline">
        {open ? t.launcher.close : t.launcher.label}
      </span>
    </button>
  );
}
