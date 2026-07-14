import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { LoginForm } from '@/features/auth/components/login-form';
import { AUTH_ROUTES, DEFAULT_AUTHED_REDIRECT } from '@/features/auth/config';
import { sanitizeRedirect } from '@/features/auth/lib/redirect';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = sanitizeRedirect(next, DEFAULT_AUTHED_REDIRECT);

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
      <LoginForm next={safeNext} />
    </AuthShell>
  );
}
