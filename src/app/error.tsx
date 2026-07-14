'use client';

import { useEffect } from 'react';
import { reportError } from '@/lib/observability/report-error';

/**
 * Route-level error boundary (App Router). Catches render/data errors below the
 * root layout and offers a recovery action. Reporting is a placeholder seam
 * (see report-error) until observability is configured.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { boundary: 'app/error', digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="font-display text-3xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">An unexpected error occurred. Please try again.</p>
      <button type="button" onClick={reset} className="text-primary underline">
        Try again
      </button>
    </main>
  );
}
