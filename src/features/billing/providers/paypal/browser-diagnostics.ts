/**
 * TEMPORARY browser-side PayPal diagnostics — REMOVE AFTER THE SANDBOX TEST.
 *
 * The server-side twin is diagnostics.ts. This one exists because the failure
 * being chased happens in the BROWSER, between PayPal reporting an approval
 * and the capture action being called — a stretch the server logs cannot see
 * at all. When the server log shows no capture request, only these lines can
 * say whether onApprove ran, whether it had an order id, and whether the
 * action was invoked, returned, or threw.
 *
 * To remove:
 *   grep -rn "ppBrowserDiag" src/    # call sites
 *   rm src/features/billing/providers/paypal/browser-diagnostics.ts
 *
 * SAFETY — what is deliberately NEVER logged:
 *   - client id, secrets, tokens
 *   - payer email, name, address, or any buyer identity
 *   - full PayPal responses or capture payloads
 *   - the order id itself (its LENGTH is logged, which is enough to tell
 *     "absent" from "present but malformed" without emitting the identifier)
 */

/** One grep-able prefix for every line this emits. */
export const PP_BROWSER_DIAG = '[pp-browser-diag]';

/**
 * Preview/development only. NEXT_PUBLIC_APP_ENV is inlined at build time, so
 * in a production build these calls compile down to a no-op and could not
 * emit anything even by accident.
 */
function enabled(): boolean {
  return process.env.NEXT_PUBLIC_APP_ENV !== 'production';
}

/**
 * NAMED "browser", not "client": in this codebase `providers/paypal/client.ts`
 * is the server-side PayPal API client holding the secret, and a second file
 * called client-anything in the same directory is exactly the confusion a
 * guardrail should refuse. It also tripped the secrets test by substring.
 *
 * Emit one flat key=value line. Values are coerced to primitives, so an object
 * — a PayPal response, a payer record — can never be spread into the console
 * by mistake.
 */
export function ppBrowserDiag(
  stage: string,
  fields: Record<string, string | number | boolean | null> = {},
): void {
  if (!enabled()) return;
  const parts = Object.entries(fields).map(([k, v]) => `${k}=${v === null ? 'none' : String(v)}`);
  // eslint-disable-next-line no-console -- temporary preview-only diagnostics
  console.log(`${PP_BROWSER_DIAG} stage=${stage} ${parts.join(' ')}`);
}
