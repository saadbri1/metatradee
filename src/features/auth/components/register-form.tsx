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
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { signUpSchema, PASSWORD_POLICY, type SignUpInput } from '../schemas';
import { AUTH_ROUTES } from '../config';
import { useSignUp } from '../hooks/use-auth-mutations';
import { applyFieldErrors } from '../lib/form-errors';
import { SubmitButton } from './submit-button';
import { PasswordInput } from './password-input';
import { FormAlert } from './form-alert';
import { SocialAuth } from './social-auth';

export function RegisterForm({ next }: { next?: string }) {
  const router = useRouter();
  const signUp = useSignUp(next);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false as unknown as true,
    },
  });

  function onSubmit(values: SignUpInput) {
    setFormError(null);
    signUp.mutate(values, {
      onSuccess: (result) => {
        if (result.ok) {
          router.replace(result.redirectTo ?? AUTH_ROUTES.verifyEmail);
          router.refresh();
          return;
        }
        if (result.fieldErrors) applyFieldErrors(form, result.fieldErrors);
        setFormError(result.error);
      },
      onError: () => setFormError('Something went wrong. Please try again.'),
    });
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

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
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
              <FormLabel>Confirm password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="acceptTerms"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  aria-describedby="terms-message"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="font-normal text-muted-foreground">
                  I agree to the Terms of Service and Privacy Policy.
                </FormLabel>
                <FormMessage id="terms-message" />
              </div>
            </FormItem>
          )}
        />

        <SubmitButton className="w-full" loading={signUp.isPending} loadingText="Creating account…">
          Create account
        </SubmitButton>

        <SocialAuth />
      </form>
    </Form>
  );
}
