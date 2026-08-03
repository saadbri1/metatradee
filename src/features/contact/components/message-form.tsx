'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodTypeAny } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { COMPANY_EMAILS, mailto, type PublicEmailKey } from '@/config/contact';
import type { SubmitResult } from '../server/actions';

/**
 * The shared contact/support form.
 *
 * ONE COMPONENT, TWO USES. Contact and support differ only in their select
 * field and their fallback mailbox, so they share the validation, the bot
 * fields, the submit lifecycle and the states — a second near-identical form
 * is how two surfaces drift apart.
 *
 * THE FALLBACK IS NOT DECORATION. Resend is not configured yet, so TODAY every
 * submission fails and this component's job is to hand the user a working
 * mailto rather than a spinner and a dead end. `showFallback` drives that, and
 * the success state is only ever reached from a server-confirmed `ok`.
 */

export interface SelectField {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

export function MessageForm({
  schema,
  action,
  select,
  fallbackMailbox,
  submitLabel = 'Send message',
}: {
  schema: ZodTypeAny;
  action: (raw: unknown) => Promise<SubmitResult>;
  select: SelectField;
  /** Where to point the user if sending is unavailable. */
  fallbackMailbox: PublicEmailKey;
  submitLabel?: string;
}) {
  /*
   * Set on MOUNT, not at render on the server. A server-rendered timestamp
   * would be the build/cache time, not when this visitor opened the page, and
   * every submission would look "stale" or "too fast" depending which way the
   * cache fell.
   */
  const renderedAt = useRef<number>(0);
  useEffect(() => {
    renderedAt.current = Date.now();
  }, []);

  const [result, setResult] = useState<SubmitResult | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), mode: 'onBlur' });

  // Move focus to the outcome so it is announced and not scrolled past.
  useEffect(() => {
    if (result) statusRef.current?.focus();
  }, [result]);

  async function onSubmit(values: Record<string, unknown>) {
    const res = await action({ ...values, renderedAt: renderedAt.current });
    setResult(res);
    if (res.ok) reset();
  }

  const fieldError = (name: string) =>
    (errors[name]?.message as string | undefined) ?? result?.fieldErrors?.[name];

  const describedBy = (name: string) => (fieldError(name) ? `${name}-error` : undefined);

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-5 rounded-2xl border border-border/70 bg-card p-6"
    >
      {/*
       * HONEYPOT. Hidden from sight AND from assistive tech, and removed from
       * the tab order — a screen-reader user must never be asked to fill the
       * trap. `display:none` alone is skipped by some bots, so it is also
       * off-screen and inert.
       */}
      <div aria-hidden className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
        <label htmlFor="company">Company (leave blank)</label>
        <input id="company" type="text" tabIndex={-1} autoComplete="off" {...register('company')} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Your name" error={fieldError('name')}>
          <Input
            id="name"
            autoComplete="name"
            aria-describedby={describedBy('name')}
            {...register('name')}
          />
        </Field>
        <Field id="email" label="Email address" error={fieldError('email')}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-describedby={describedBy('email')}
            {...register('email')}
          />
        </Field>
      </div>

      <Field id={select.name} label={select.label} error={fieldError(select.name)}>
        <select
          id={select.name}
          aria-describedby={describedBy(select.name)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          {...register(select.name)}
        >
          {select.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Field id="subject" label="Subject" error={fieldError('subject')}>
        <Input id="subject" aria-describedby={describedBy('subject')} {...register('subject')} />
      </Field>

      <Field id="message" label="Message" error={fieldError('message')}>
        <Textarea
          id="message"
          rows={6}
          aria-describedby={describedBy('message')}
          {...register('message')}
        />
      </Field>

      <div>
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 rounded border-input"
            aria-describedby={describedBy('consent')}
            {...register('consent')}
          />
          <span className="text-muted-foreground">
            I agree that MetaTradee may use the details above to reply to this message.
          </span>
        </label>
        {fieldError('consent') ? (
          <p id="consent-error" className="mt-1.5 text-sm text-destructive">
            {fieldError('consent')}
          </p>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Never include passwords, broker credentials, API keys or full card numbers.
      </p>

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : submitLabel}
      </Button>

      {result ? (
        <div
          ref={statusRef}
          tabIndex={-1}
          role={result.ok ? 'status' : 'alert'}
          aria-live="polite"
          className={cn(
            'rounded-xl border p-4 text-sm outline-none',
            result.ok
              ? 'border-success/30 bg-success/5 text-foreground'
              : 'border-destructive/30 bg-destructive/5 text-foreground',
          )}
        >
          <p className={result.ok ? 'font-medium text-success' : 'font-medium text-destructive'}>
            {result.message}
          </p>
          {result.showFallback ? (
            /*
             * The honest path. Sending is unavailable, so the user gets a
             * working address instead of being told to try again later.
             */
            <p className="mt-2 text-muted-foreground">
              Email us directly at{' '}
              <a
                href={mailto(fallbackMailbox)}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {COMPANY_EMAILS[fallbackMailbox]}
              </a>
              .
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
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
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
