'use client';

import { useState } from 'react';
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

export function ResendVerificationForm({ defaultEmail }: { defaultEmail?: string }) {
  const resend = useResendVerification();
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ResendVerificationInput>({
    resolver: zodResolver(resendVerificationSchema),
    defaultValues: { email: defaultEmail ?? '' },
  });

  function onSubmit(values: ResendVerificationInput) {
    setFormError(null);
    resend.mutate(values, {
      onSuccess: (result) => {
        if (result.ok || !result.fieldErrors) {
          setDone(true);
          return;
        }
        setFormError(result.error);
      },
      onError: () => setFormError('Something went wrong. Please try again.'),
    });
  }

  if (done) return <FormAlert tone="success">{NEUTRAL_SUCCESS}</FormAlert>;

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
        >
          Resend verification email
        </SubmitButton>
      </form>
    </Form>
  );
}
