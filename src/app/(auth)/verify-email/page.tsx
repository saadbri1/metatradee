import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { ResendVerificationForm } from '@/features/auth/components/resend-verification-form';
import { SignOutButton } from '@/features/auth/components/sign-out-button';
import { getAuthenticatedUser } from '@/features/auth/server/session';
import { getPendingVerificationEmail } from '@/features/auth/server/pending-email';
import { FormAlert } from '@/features/auth/components/form-alert';
import { AUTH_ROUTES, DEFAULT_AUTHED_REDIRECT, authErrorMessage } from '@/features/auth/config';

export const metadata: Metadata = { title: 'Verify your email' };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Just-registered users have no session (confirmation required); a signed-in
  // + already-verified user shouldn't be here.
  const user = await getAuthenticatedUser();
  if (user?.emailVerified) redirect(DEFAULT_AUTHED_REDIRECT);

  const { error } = await searchParams;
  const errorMessage = authErrorMessage(error);

  /*
   * Which address to go and check. Read from an httpOnly cookie set at signup,
   * never from the URL — a `?email=` would put it in browser history, the
   * Referer header, access logs and analytics. Falls back to the session's
   * address for a signed-in-but-unverified user, and to nothing at all rather
   * than guessing.
   */
  const pendingEmail = user?.email ?? (await getPendingVerificationEmail());

  return (
    <AuthShell
      title="Check your inbox"
      description="We've sent you a verification link. Click it to activate your account."
      footer={
        user ? (
          <SignOutButton />
        ) : (
          <Link
            href={AUTH_ROUTES.login}
            className="text-primary underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        )
      }
    >
      <div className="space-y-6">
        {errorMessage ? <FormAlert tone="error">{errorMessage}</FormAlert> : null}

        {pendingEmail ? (
          <p className="text-sm text-muted-foreground">
            We sent it to{' '}
            <strong className="break-all font-medium text-foreground">{pendingEmail}</strong>.
          </p>
        ) : null}

        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          <MailCheck className="size-5 shrink-0 text-primary" aria-hidden />
          <p>Didn&apos;t get it? Check your spam folder, or request a new link below.</p>
        </div>
        <ResendVerificationForm defaultEmail={pendingEmail ?? undefined} />
      </div>
    </AuthShell>
  );
}
