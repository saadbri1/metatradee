'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { resetPasswordSchema, PASSWORD_POLICY, type ResetPasswordInput } from '../schemas';
import { DEFAULT_AUTHED_REDIRECT } from '../config';
import { useResetPassword } from '../hooks/use-auth-mutations';
import { applyFieldErrors } from '../lib/form-errors';
import { SubmitButton } from './submit-button';
import { PasswordInput } from './password-input';
import { FormAlert } from './form-alert';

export function ResetPasswordForm() {
  const router = useRouter();
  const reset = useResetPassword();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  function onSubmit(values: ResetPasswordInput) {
    setFormError(null);
    reset.mutate(values, {
      onSuccess: (result) => {
        if (result.ok) {
          setDone(true);
          router.replace(result.redirectTo ?? DEFAULT_AUTHED_REDIRECT);
          router.refresh();
          return;
        }
        if (result.fieldErrors) applyFieldErrors(form, result.fieldErrors);
        setFormError(result.error);
      },
      onError: () => setFormError('Something went wrong. Please try again.'),
    });
  }

  if (done) {
    return (
      <FormAlert tone="success">Password updated. Other sessions have been signed out.</FormAlert>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" autoFocus {...field} />
              </FormControl>
              <FormDescription>
                At least {PASSWORD_POLICY.minLength} characters, including a letter and a number.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm new password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <SubmitButton className="w-full" loading={reset.isPending} loadingText="Updating…">
          Update password
        </SubmitButton>
      </form>
    </Form>
  );
}
