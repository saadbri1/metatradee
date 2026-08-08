/**
 * `trackEvent` — the only way anything in this codebase reports an event.
 *
 * A SEAM, NOT A VENDOR. It follows the pattern `lib/observability/report-error.ts`
 * already sets: call sites bind to our own function, and the vendor lives behind
 * a swappable sink. Changing analytics provider is then one file, not a hundred
 * call sites — which matters here because the provider question is genuinely
 * unsettled (see `docs/seo-measurement-plan.md`).
 *
 * IT NEVER THROWS. Analytics is the least important thing on any page it runs
 * on. Every failure path — a blocked script, an ad blocker, a sink that errors,
 * a malformed payload — ends in the event being dropped and the page carrying
 * on. A calculator must never break because a beacon did.
 *
 * IT IS CLIENT-ONLY BY DESIGN. Server-side events would need a request context
 * and would tempt someone into attaching a user id. If a server-side event is
 * ever genuinely needed, add a separate sink with its own review.
 */
import { sanitizeProps } from './sanitize';
import type { AnalyticsEventName, PropsFor } from './events';

/** Where sanitised events go. Swap the implementation, not the call sites. */
export interface AnalyticsSink {
  track(name: string, props: Record<string, string | boolean>): void;
}

/**
 * The default sink does nothing.
 *
 * Deliberate: with no sink installed the whole system is inert, so importing
 * analytics into a test, a story, or a server render sends nothing anywhere.
 */
const noopSink: AnalyticsSink = { track: () => {} };

let sink: AnalyticsSink = noopSink;

/** Install the real sink. Called once, from the client provider. */
export function setAnalyticsSink(next: AnalyticsSink): void {
  sink = next;
}

/** Restore the inert sink. Used by tests so state cannot leak between them. */
export function resetAnalyticsSink(): void {
  sink = noopSink;
}

const isDev = process.env.NODE_ENV === 'development';

/**
 * Report an event.
 *
 * The generic ties `props` to `name`, so the compiler rejects a payload that
 * does not belong to the event — including one carrying a financial value.
 *
 * ```ts
 * trackEvent('calculator_completed', { calculator: 'xauusd_lot_size' });
 * ```
 */
export function trackEvent<N extends AnalyticsEventName>(name: N, props: PropsFor<N>): void {
  try {
    const { props: safe, dropped } = sanitizeProps(name, props as Record<string, unknown>);

    if (dropped.length > 0 && isDev) {
      /*
       * Loud in development, silent in production. Something reached here that
       * the types should have stopped, and the developer who wrote it is the
       * only person who can fix it.
       */
      console.warn(`[analytics] dropped from "${name}": ${dropped.join('; ')}`);
    }

    sink.track(name, safe);
  } catch {
    /*
     * Swallowed on purpose and not logged: the failure is already invisible to
     * the user, and an error handler that itself reports would be a loop.
     */
  }
}
