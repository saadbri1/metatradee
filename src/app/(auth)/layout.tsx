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
