import type { ReactNode } from 'react';

/**
 * Public layout for authentication screens. Presentational only — route
 * protection and signed-in bounces are enforced in middleware. Provides the
 * page landmark and centers the auth card.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      {children}
    </main>
  );
}
