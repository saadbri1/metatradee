import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { LoginForm } from '@/features/auth/components/login-form';
import { FormAlert } from '@/features/auth/components/form-alert';
import { AUTH_ROUTES, DEFAULT_AUTHED_REDIRECT, authErrorMessage } from '@/features/auth/config';
import { sanitizeRedirect } from '@/features/auth/lib/redirect';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const safeNext = sanitizeRedirect(next, DEFAULT_AUTHED_REDIRECT);
  /*
   * Only codes from our own closed set produce a message. An unrecognised
   * `?error=` renders nothing, so a crafted link cannot put chosen text on the
   * sign-in page.
   */
  const errorMessage = authErrorMessage(error);

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your MetaTradee account."
      footer={
        <span>
          New to MetaTradee?{' '}
          <Link
            href={AUTH_ROUTES.register}
            className="text-primary underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </span>
      }
    >
      <div className="space-y-4">
        {errorMessage ? <FormAlert tone="error">{errorMessage}</FormAlert> : null}
        <LoginForm next={safeNext} />
      </div>
    </AuthShell>
  );
}
