import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/features/auth/server/session';
import { getProfile } from '@/features/workspace/server/queries';
import { ensureWorkspaceDefaults } from '@/lib/db/provisioning';
import { DashboardShell } from '@/features/shell/components/dashboard-shell';
import type { ShellUser } from '@/features/shell/types';

/**
 * Authenticated app layout. Runs the auth guard + idempotent provisioning +
 * onboarding gate, then wraps every in-app route in the dashboard shell (9.5).
 * `/onboarding` lives in a separate route group, so there is no redirect loop.
 */
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const user = await requireAuth();
  await ensureWorkspaceDefaults();

  const profile = await getProfile();
  if (profile && !profile.onboarding_completed) {
    redirect('/onboarding');
  }

  const shellUser: ShellUser = {
    displayName: profile?.display_name || user.email || 'Trader',
    username: profile?.username ?? null,
    email: user.email,
    avatarUrl: profile?.avatar_url ?? null,
  };

  return <DashboardShell user={shellUser}>{children}</DashboardShell>;
}
