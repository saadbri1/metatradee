/**
 * Error-reporting seam (placeholder).
 *
 * This is where Sentry (or any monitor) will be wired in a later phase. It is
 * intentionally a no-op today — NO monitoring logic is implemented here yet.
 * Error boundaries and future server code call `reportError(...)` now, so the
 * integration point already exists and the call sites never change when the
 * real SDK lands.
 *
 * When Sentry is enabled (env: NEXT_PUBLIC_SENTRY_DSN / SENTRY_DSN), replace the
 * body with `Sentry.captureException(error, { extra: context })`.
 */
export interface ErrorContext {
  /** Where the error was caught, e.g. 'app/error' | 'app/global-error'. */
  boundary?: string;
  /** React error digest, when provided by Next.js. */
  digest?: string;
  [key: string]: unknown;
}

export function reportError(_error: unknown, _context?: ErrorContext): void {
  // Placeholder: intentionally does nothing until observability is configured.
  // Do not add logging or side effects here — this is a wiring seam only.
}
