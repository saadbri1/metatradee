import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { AUTH_ROUTES } from '@/features/auth/config';

export const metadata: Metadata = { title: 'Access denied' };

/**
 * 403 surface. Shown when an authenticated user lacks permission for a resource
 * (RBAC seam). Distinct from the login redirect for unauthenticated users.
 */
export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <ShieldAlert className="size-10 text-warning" aria-hidden />
      <h1 className="font-display text-3xl font-semibold tracking-tight">Access denied</h1>
      <p className="max-w-md text-muted-foreground">
        You don&apos;t have permission to view this page. If you think this is a mistake, contact
        your account owner.
      </p>
      <Link href={AUTH_ROUTES.login} className="text-primary underline-offset-4 hover:underline">
        Return to sign in
      </Link>
    </main>
  );
}
