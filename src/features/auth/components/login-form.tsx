'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { signInSchema, type SignInInput } from '../schemas';
import { AUTH_ROUTES, DEFAULT_AUTHED_REDIRECT } from '../config';
import { useSignIn } from '../hooks/use-auth-mutations';
import { applyFieldErrors } from '../lib/form-errors';
import { SubmitButton } from './submit-button';
import { PasswordInput } from './password-input';
import { FormAlert } from './form-alert';
import { SocialAuth } from './social-auth';

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const signIn = useSignIn(next);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '', rememberMe: true },
  });

  function onSubmit(values: SignInInput) {
    setFormError(null);
    signIn.mutate(values, {
      onSuccess: (result) => {
        if (result.ok) {
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
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
                <Link
                  href={AUTH_ROUTES.forgotPassword}
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <FormControl>
                <PasswordInput autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rememberMe"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  id="rememberMe"
                />
              </FormControl>
              <Label htmlFor="rememberMe" className="font-normal text-muted-foreground">
                Keep me signed in
              </Label>
            </FormItem>
          )}
        />

        <SubmitButton className="w-full" loading={signIn.isPending} loadingText="Signing in…">
          Sign in
        </SubmitButton>

        <SocialAuth />
      </form>
    </Form>
  );
}
