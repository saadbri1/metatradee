import type { ReactNode } from 'react';
import { requireAuth } from '@/features/auth/server/session';
import { ensureWorkspaceDefaults } from '@/lib/db/provisioning';

/**
 * Onboarding layout: requires auth (defense-in-depth beyond middleware) and
 * runs idempotent first-login provisioning. Intentionally does NOT apply the
 * onboarding-complete gate — this is where incomplete users belong.
 */
export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  await requireAuth('/onboarding');
  await ensureWorkspaceDefaults();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">{children}</main>
  );
}
