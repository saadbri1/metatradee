'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { resendVerificationSchema, type ResendVerificationInput } from '../schemas';
import { useResendVerification } from '../hooks/use-auth-mutations';
import { SubmitButton } from './submit-button';
import { FormAlert } from './form-alert';

const NEUTRAL_SUCCESS = 'If your email needs verifying, a new link is on its way.';

/**
 * Seconds before another link may be requested.
 *
 * A CLIENT-SIDE COURTESY, NOT THE CONTROL. The real limit is
 * `enforceRateLimit` on the server, which a countdown in a browser obviously
 * cannot enforce. What this prevents is the honest failure mode: someone whose
 * mail is slow pressing the button four times, generating four links — of which
 * only the newest works — and then reporting that verification is broken.
 */
const COOLDOWN_SECONDS = 60;

export function ResendVerificationForm({ defaultEmail }: { defaultEmail?: string }) {
  const resend = useResendVerification();
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const form = useForm<ResendVerificationInput>({
    resolver: zodResolver(resendVerificationSchema),
    defaultValues: { email: defaultEmail ?? '' },
  });

  function onSubmit(values: ResendVerificationInput) {
    if (cooldown > 0 || resend.isPending) return;
    setFormError(null);
    resend.mutate(values, {
      onSuccess: (result) => {
        if (result.ok || !result.fieldErrors) {
          setDone(true);
          setCooldown(COOLDOWN_SECONDS);
          return;
        }
        setFormError(result.error);
      },
      onError: () => setFormError('Something went wrong. Please try again.'),
    });
  }

  /*
   * After a send: confirm it, and keep the form available behind a countdown
   * rather than replacing it outright. Someone who mistyped their address needs
   * to correct it and try again — and the previous version left them with a
   * success message and no way back.
   */
  if (done) {
    return (
      <div className="space-y-4">
        <FormAlert tone="success">{NEUTRAL_SUCCESS}</FormAlert>
        <button
          type="button"
          onClick={() => setDone(false)}
          disabled={cooldown > 0}
          className="text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
        >
          {cooldown > 0 ? `Send again in ${cooldown}s` : 'Use a different address or send again'}
        </button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <SubmitButton
          className="w-full"
          variant="outline"
          loading={resend.isPending}
          loadingText="Sending…"
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
        </SubmitButton>
      </form>
    </Form>
  );
}
