import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { AUTH_ROUTES, NEXT_PARAM } from '@/features/auth/config';
import { sanitizeRedirect } from '@/features/auth/lib/redirect';

export const metadata: Metadata = { title: 'Session expired' };

/**
 * Shown when a session can no longer be refreshed. Preserves a sanitized return
 * path so the user resumes where they left off after re-authenticating.
 */
export default async function SessionExpiredPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = sanitizeRedirect(next, '/');
  const loginHref = `${AUTH_ROUTES.login}?${NEXT_PARAM}=${encodeURIComponent(safeNext)}`;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <Clock className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="font-display text-3xl font-semibold tracking-tight">Your session expired</h1>
      <p className="max-w-md text-muted-foreground">
        For your security, you&apos;ve been signed out due to inactivity. Please sign in again to
        continue.
      </p>
      <Link href={loginHref} className="text-primary underline-offset-4 hover:underline">
        Sign in again
      </Link>
    </main>
  );
}
