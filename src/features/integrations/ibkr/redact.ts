/**
 * Redaction helpers. Pure, so the guarantees below are unit-testable.
 *
 * Nothing in this integration returns a raw account number, a token, or a query
 * id. These functions are the single place that decides what a "safe" rendering
 * of an identifier looks like.
 */

/**
 * Mask an IBKR account id, keeping only enough to recognise which account
 * answered: the leading letter (U = individual, DU = paper) and the last two
 * digits.
 *
 *   "U1234567"  → "U•••••67"
 *   "DU5551234" → "DU•••••34"
 *
 * Anything too short to mask meaningfully collapses entirely, so a short or
 * unexpected value can never leak in full.
 */
export function maskAccountId(accountId: string | null | undefined): string | null {
  if (!accountId) return null;
  const value = accountId.trim();
  if (value.length === 0) return null;

  const prefix = value.match(/^[A-Za-z]+/)?.[0] ?? '';
  const tail = value.slice(-2);
  const hiddenCount = value.length - prefix.length - 2;

  // Not enough body to mask — reveal nothing beyond the shape.
  if (hiddenCount < 1) return '•'.repeat(value.length);

  return `${prefix}${'•'.repeat(hiddenCount)}${tail}`;
}

/**
 * IBKR paper-trading accounts are prefixed `DU`. Anything else is reported as
 * `unknown` rather than guessed as live — claiming an account is paper when it
 * might not be is the dangerous direction of that error.
 */
export function classifyEnvironment(accountId: string | null | undefined): 'paper' | 'unknown' {
  if (!accountId) return 'unknown';
  return /^DU/i.test(accountId.trim()) ? 'paper' : 'unknown';
}

/**
 * Strip anything secret-shaped out of a string before it could be logged.
 *
 * Defence in depth: the client never logs URLs and never puts a secret in an
 * error, but if a future change does, this removes `t=` / `q=` query values and
 * any long opaque token-like run of characters.
 */
export function redactSecrets(input: string): string {
  return input
    .replace(/([?&](?:t|q))=[^&\s]+/gi, '$1=REDACTED')
    .replace(/\b[A-Za-z0-9]{20,}\b/g, 'REDACTED');
}
