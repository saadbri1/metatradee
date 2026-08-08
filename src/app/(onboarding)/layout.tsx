import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { requireAuth } from '@/features/auth/server/session';
import { ensureWorkspaceDefaults } from '@/lib/db/provisioning';

/**
 * Onboarding layout: requires auth (defense-in-depth beyond middleware) and
 * runs idempotent first-login provisioning. Intentionally does NOT apply the
 * onboarding-complete gate — this is where incomplete users belong.
 */
/**
 * NOINDEX FOR EVERY ROUTE IN THIS GROUP.
 *
 * Declared on the LAYOUT rather than on each page so a route added later
 * inherits it by default — the failure mode worth engineering against is the
 * page someone forgets, not the one they remember. Pages may still set their
 * own title; Next merges metadata per field, so a page-level `title` does not
 * drop this `robots` value.
 *
 * These paths are deliberately NOT disallowed in robots.txt: a crawler must be
 * able to fetch a page to see `noindex`, so blocking it would preserve exactly
 * the indexing this removes.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  await requireAuth('/onboarding');
  await ensureWorkspaceDefaults();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">{children}</main>
  );
}
