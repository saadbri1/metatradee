/**
 * TEMPORARY PayPal verification diagnostics — REMOVE AFTER THE SANDBOX TEST.
 *
 * Everything lives in this one file so removal is: delete this file, then
 * delete the ~6 `ppDiag(...)` call sites the grep in the header comment finds.
 * Nothing else changes, because these calls only observe — they never alter a
 * decision, a status, or a response.
 *
 * To remove:
 *   grep -rn "ppDiag" src/    # call sites
 *   rm src/features/billing/providers/paypal/diagnostics.ts
 *
 * SAFETY — what is deliberately NEVER logged:
 *   - client id / secret / access tokens / webhook id
 *   - full webhook payloads or PayPal response bodies
 *   - email addresses, names, addresses, card or bank details
 *   - signature headers
 *
 * Identifiers are truncated. A PayPal subscription id and a user id are not
 * credentials, but they are still identifiers, so only enough is emitted to
 * correlate one request across the three stages of the flow.
 */
import 'server-only';

/** One grep-able prefix for every line this emits. */
export const PP_DIAG = '[pp-diag]';

/**
 * Diagnostics are Preview/sandbox only. In live they are a no-op, so shipping
 * this file to production could not leak anything even by accident.
 */
function enabled(): boolean {
  return process.env.PAYPAL_ENVIRONMENT !== 'live';
}

/** First 10 chars — enough to correlate, not enough to be a useful identifier. */
function short(value: string | null | undefined): string {
  if (!value) return 'none';
  return value.length <= 10 ? value : `${value.slice(0, 10)}…`;
}

/**
 * Emit one flat key=value line. Values are coerced to primitives, so an object
 * can never be spread into the log by mistake.
 */
export function ppDiag(stage: string, fields: Record<string, string | number | boolean | null>) {
  if (!enabled()) return;
  const parts = Object.entries(fields).map(([k, v]) => `${k}=${v === null ? 'none' : String(v)}`);
  // console.log is what Vercel captures as a runtime log line.
  console.log(`${PP_DIAG} stage=${stage} ${parts.join(' ')}`);
}

/** Shared shorteners, so every stage truncates identically. */
export const diag = {
  subscriptionId: short,
  userId: short,
};
