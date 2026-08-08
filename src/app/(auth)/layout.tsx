import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { BrandLockup } from '@/features/marketing/components/brand-mark';

/**
 * Public layout for authentication screens. Presentational only — route
 * protection and signed-in bounces are enforced in middleware. Provides the
 * page landmark and centers the auth card.
 *
 * Carries the same official lockup as the marketing header, so Log in and Get
 * Started are unmistakably the same product. Presentation only: no
 * authentication behaviour is touched here.
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

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <Link
        href="/"
        aria-label={`${siteConfig.name} home`}
        className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
      >
        <BrandLockup size={40} />
      </Link>
      {children}
    </main>
  );
}
