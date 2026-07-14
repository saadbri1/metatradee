'use client';

import { useEffect } from 'react';
import { reportError } from '@/lib/observability/report-error';

/**
 * Root error boundary. Only renders when the root layout itself throws, so it
 * must provide its own <html>/<body> and cannot depend on the token stylesheet.
 * Styling is intentionally minimal and self-contained. Reporting is a
 * placeholder seam until observability is configured.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { boundary: 'app/global-error', digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100vh',
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#0A0B0E',
          color: '#F3F5F9',
        }}
      >
        <h1 style={{ fontSize: '1.875rem', fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ opacity: 0.7 }}>A critical error occurred. Please try again.</p>
        <button
          type="button"
          onClick={reset}
          style={{
            background: 'none',
            border: 'none',
            color: '#5B6CFF',
            textDecoration: 'underline',
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
