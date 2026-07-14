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
import { forgotPasswordSchema, type ForgotPasswordInput } from '../schemas';
import { useRequestPasswordReset } from '../hooks/use-auth-mutations';
import { SubmitButton } from './submit-button';
import { FormAlert } from './form-alert';

// Neutral copy — never reveals whether an account exists.
const NEUTRAL_SUCCESS = 'If an account exists for that email, a password reset link is on its way.';

export function ForgotPasswordForm() {
  const request = useRequestPasswordReset();
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  function onSubmit(values: ForgotPasswordInput) {
    setFormError(null);
    request.mutate(values, {
      onSuccess: (result) => {
        // Success is neutral; only true validation/rate errors surface.
        if (result.ok || !result.fieldErrors) {
          setDone(true);
          return;
        }
        setFormError(result.error);
      },
      onError: () => setFormError('Something went wrong. Please try again.'),
    });
  }

  if (done) {
    return <FormAlert tone="success">{NEUTRAL_SUCCESS}</FormAlert>;
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
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  autoFocus
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <SubmitButton className="w-full" loading={request.isPending} loadingText="Sending…">
          Send reset link
        </SubmitButton>
      </form>
    </Form>
  );
}
