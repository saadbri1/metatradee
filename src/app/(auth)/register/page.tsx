import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { RegisterForm } from '@/features/auth/components/register-form';
import { AUTH_ROUTES, DEFAULT_AUTHED_REDIRECT } from '@/features/auth/config';
import { sanitizeRedirect } from '@/features/auth/lib/redirect';

export const metadata: Metadata = { title: 'Create account' };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = sanitizeRedirect(next, DEFAULT_AUTHED_REDIRECT);

  return (
    <AuthShell
      title="Create your account"
      description="Start journaling and protecting your trades."
      footer={
        <span>
          Already have an account?{' '}
          <Link
            href={AUTH_ROUTES.login}
            className="text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </span>
      }
    >
      <RegisterForm next={safeNext} />
    </AuthShell>
  );
}
