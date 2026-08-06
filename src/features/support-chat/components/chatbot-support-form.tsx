'use client';

/**
 * Handing the conversation to a person.
 *
 * IT REUSES PHASE 2 END TO END. The submission goes through
 * `submitChatEscalationAction`, which delegates to the existing support action
 * — same schema, same honeypot, same timing check, same rate limit, same
 * sanitiser, same routing to `COMPANY_EMAILS.support`. This component adds a
 * translated surface over that, and nothing else.
 *
 * IT CANNOT FAKE A SUCCESS. Resend is still not configured, so today every
 * submission comes back `ok: false` and this form's real job is to hand over a
 * working address. The success branch is reachable only from a server-confirmed
 * `ok`, which is why the result is rendered from the action's response rather
 * than optimistically on submit.
 *
 * THE HONEYPOT AND THE TIMING FIELD ARE HERE TOO. They are what the shared
 * guard checks; a form that omitted them would be refused by the very
 * protection it was meant to inherit.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COMPANY_EMAILS, mailto } from '@/config/contact';
import { SUPPORT_CATEGORIES, type SupportCategory } from '@/features/contact/schemas';
import { escalationSchema } from '../schemas';
import { buildEscalationMessage } from '../transcript';
import { dictionaryFor } from '../translations';
import { submitChatEscalationAction, type ChatEscalationResult } from '../server/actions';
import {
  LOCALE_DIRECTION,
  LOCALE_HTML_LANG,
  type ChatMessage,
  type EscalationPhase,
  type SupportChatLocale,
} from '../types';

/* `h-11` on the single-line controls: 44px is the minimum comfortable touch
   target, and these are the fields someone fills on a phone one-handed. */
const FIELD_CLASS =
  'h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function ChatbotSupportForm({
  locale,
  messages,
  suggestedCategory,
  onBack,
}: {
  locale: SupportChatLocale;
  messages: ChatMessage[];
  /**
   * Category implied by the conversation. Someone escalating a billing dispute
   * has already said so once; making them restate it in a dropdown is the kind
   * of small indignity that makes a handover feel like starting over.
   */
  suggestedCategory?: string | null;
  onBack: () => void;
}) {
  const t = dictionaryFor(locale);
  /* Validated against the real enum — a category from the wire is still input. */
  const defaultCategory: SupportCategory = SUPPORT_CATEGORIES.includes(
    suggestedCategory as SupportCategory,
  )
    ? (suggestedCategory as SupportCategory)
    : 'other';
  const [phase, setPhase] = useState<EscalationPhase>('form');
  const [result, setResult] = useState<ChatEscalationResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [includeTranscript, setIncludeTranscript] = useState(true);
  const statusRef = useRef<HTMLDivElement>(null);

  /*
   * Stamped on MOUNT, not during render. A value produced on the server would
   * be the build or cache time rather than when this visitor opened the form,
   * and the shared timing check would read every submission as stale or as
   * impossibly fast depending which way the cache fell.
   */
  const renderedAt = useRef(0);
  useEffect(() => {
    renderedAt.current = Date.now();
  }, []);

  // Move focus to the outcome so it is announced rather than scrolled past.
  useEffect(() => {
    if (result) statusRef.current?.focus();
  }, [result]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const description = String(form.get('message') ?? '');

    const candidate = {
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      subject: String(form.get('subject') ?? ''),
      category: String(form.get('category') ?? 'other') as SupportCategory,
      message: description,
      consent: form.get('consent') === 'on',
    };

    /*
     * Validated here purely so the messages are in the visitor's language. The
     * server validates the same payload again with the Phase 2 schema, and that
     * is the check that decides whether anything is sent.
     */
    const parsed = escalationSchema(locale).safeParse(candidate);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setErrors({});
    setPhase('sending');

    const response = await submitChatEscalationAction({
      ...parsed.data,
      locale,
      // The conversation is folded into the message, redacted and length-capped.
      message: buildEscalationMessage({
        description: parsed.data.message,
        messages,
        locale,
        includeTranscript,
      }),
      company: String(form.get('company') ?? ''),
      renderedAt: renderedAt.current,
    });

    setResult(response);
    setErrors(response.fieldErrors ?? {});
    setPhase(response.ok ? 'sent' : 'failed');
  }

  const error = (field: string) => errors[field];
  const describedBy = (field: string) => (error(field) ? `chat-${field}-error` : undefined);

  if (phase === 'sent' && result?.ok) {
    return (
      <div className="p-4">
        <div
          ref={statusRef}
          tabIndex={-1}
          role="status"
          className="rounded-xl border border-success/30 bg-success/5 p-4 text-sm outline-none"
        >
          <p className="flex items-start gap-2 font-medium text-success">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            {result.message}
          </p>
        </div>
        <BackButton label={t.escalation.back} onClick={onBack} />
      </div>
    );
  }

  return (
    <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <BackButton label={t.escalation.back} onClick={onBack} />

      <h3 className="mt-3 font-display text-base font-semibold tracking-tight text-foreground">
        {t.escalation.title}
      </h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{t.escalation.lede}</p>

      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
        {/*
         * HONEYPOT — hidden from sight, from assistive tech and from the tab
         * order. A screen-reader user must never be asked to fill the trap.
         */}
        <div aria-hidden className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden">
          <label htmlFor="chat-company">Company (leave blank)</label>
          <input id="chat-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <Field id="chat-name" label={t.form.name} error={error('name')}>
          <input
            id="chat-name"
            name="name"
            autoComplete="name"
            aria-describedby={describedBy('name')}
            className={FIELD_CLASS}
          />
        </Field>

        <Field id="chat-email" label={t.form.email} error={error('email')}>
          <input
            id="chat-email"
            name="email"
            type="email"
            autoComplete="email"
            dir="ltr"
            aria-describedby={describedBy('email')}
            className={FIELD_CLASS}
          />
        </Field>

        <Field id="chat-category" label={t.form.category} error={error('category')}>
          <select
            id="chat-category"
            name="category"
            defaultValue={defaultCategory}
            aria-describedby={describedBy('category')}
            className={FIELD_CLASS}
          >
            {SUPPORT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t.categories[category]}
              </option>
            ))}
          </select>
        </Field>

        <Field id="chat-subject" label={t.form.subject} error={error('subject')}>
          <input
            id="chat-subject"
            name="subject"
            aria-describedby={describedBy('subject')}
            className={FIELD_CLASS}
          />
        </Field>

        <Field id="chat-message" label={t.form.message} error={error('message')}>
          <textarea
            id="chat-message"
            name="message"
            rows={4}
            lang={LOCALE_HTML_LANG[locale]}
            dir={LOCALE_DIRECTION[locale]}
            aria-describedby={describedBy('message')}
            className={cn(FIELD_CLASS, 'h-auto resize-none py-2 leading-6')}
          />
        </Field>

        {messages.length > 0 ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <label className="flex min-h-11 items-start gap-2.5 py-1.5 text-xs leading-5">
              <input
                type="checkbox"
                checked={includeTranscript}
                onChange={(event) => setIncludeTranscript(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 rounded border-input"
              />
              <span>
                <span className="font-medium text-foreground">
                  {t.escalation.includeTranscript}
                </span>
                <span className="block text-muted-foreground">{t.escalation.transcriptNote}</span>
              </span>
            </label>
          </div>
        ) : null}

        <div>
          <label className="flex min-h-11 items-start gap-2.5 py-1.5 text-xs leading-5">
            <input
              type="checkbox"
              name="consent"
              aria-describedby={describedBy('consent')}
              className="mt-0.5 size-4 shrink-0 rounded border-input"
            />
            <span className="text-muted-foreground">{t.form.consent}</span>
          </label>
          {error('consent') ? (
            <p id="chat-consent-error" className="mt-1 text-xs text-destructive">
              {error('consent')}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={phase === 'sending'}
          className="min-h-11 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors duration-fast hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 motion-reduce:transition-none"
        >
          {phase === 'sending' ? t.escalation.sending : t.escalation.submit}
        </button>

        {result && !result.ok ? (
          <div
            ref={statusRef}
            tabIndex={-1}
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs outline-none"
          >
            <p className="font-medium text-destructive">{result.message}</p>
            {result.showFallback ? (
              /*
               * The honest path. Sending is unavailable, so the visitor gets a
               * working address instead of being told to try again later.
               */
              <p className="mt-1.5 flex flex-wrap items-center gap-1 text-muted-foreground">
                <Mail className="size-3.5" aria-hidden />
                {t.escalation.fallbackPrefix}{' '}
                <a
                  href={mailto('support')}
                  dir="ltr"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {COMPANY_EMAILS.support}
                </a>
              </p>
            ) : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
    >
      <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />
      {label}
    </button>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
