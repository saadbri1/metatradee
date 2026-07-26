/**
 * Safe, provider-neutral categories for an AI connection check.
 *
 * WHY THIS IS ITS OWN PURE MODULE: the categoriser must be unit-testable
 * without a network, and — more importantly — it is the single place that
 * decides what leaves the server. It maps a provider's HTTP status and error
 * code onto a FIXED enum. Provider error text is never returned, so a
 * misconfigured account, an organisation id, or anything the provider chooses
 * to echo back can never reach the client.
 *
 * The API key is never an input to this module and never appears in its output.
 */

export const CONNECTION_CATEGORIES = [
  'permission',
  'invalid_key',
  'missing_billing',
  'quota',
  'model_access',
  'network',
  'unknown',
] as const;

export type ConnectionCategory = (typeof CONNECTION_CATEGORIES)[number];

/** Short, safe, human-readable explanation. Contains no provider text. */
export const CATEGORY_MESSAGE: Record<ConnectionCategory, string> = {
  permission: 'The key is valid but lacks permission for this request.',
  invalid_key: 'The API key was rejected as invalid, revoked, or malformed.',
  missing_billing: 'The account has no active billing set up.',
  quota: 'The account is out of quota or is being rate limited.',
  model_access: 'The account cannot access the requested model.',
  network: 'The provider could not be reached, or the request timed out.',
  unknown: 'The provider returned an unrecognised error.',
};

/**
 * Classify a failed HTTP response.
 *
 * Order matters: an explicit provider error code is more reliable than the
 * status alone (a 429, for example, is quota OR billing depending on the code,
 * and a 403 is permission OR model access).
 */
export function categorizeHttpFailure(
  status: number,
  errorCode?: string | null,
): ConnectionCategory {
  const code = (errorCode ?? '').toLowerCase();

  // Explicit provider codes first — these are unambiguous.
  if (code.includes('insufficient_quota')) return 'quota';
  if (code.includes('billing_not_active') || code.includes('billing_hard_limit')) {
    return 'missing_billing';
  }
  if (code.includes('invalid_api_key') || code.includes('invalid_authentication')) {
    return 'invalid_key';
  }
  if (code.includes('model_not_found') || code.includes('unsupported_model')) {
    return 'model_access';
  }
  if (code.includes('rate_limit')) return 'quota';
  if (code.includes('unsupported_country') || code.includes('permission')) return 'permission';

  // Fall back to the status.
  switch (status) {
    case 401:
      return 'invalid_key';
    case 402:
      return 'missing_billing';
    case 403:
      // 403 without a code is an entitlement problem; the model probe below
      // distinguishes model access when the provider says so explicitly.
      return 'permission';
    case 404:
      // The Responses endpoint exists, so a 404 here means the MODEL is not
      // visible to this account.
      return 'model_access';
    case 429:
      return 'quota';
    default:
      if (status >= 500) return 'network';
      return 'unknown';
  }
}

/** Classify a thrown transport error (DNS, TLS, socket, abort/timeout). */
export function categorizeTransportError(error: unknown): ConnectionCategory {
  // Every fetch-level failure is a reachability problem from our side. We do
  // not inspect the message for detail we would then have to sanitise.
  if (error instanceof Error && error.name === 'AbortError') return 'network';
  return 'network';
}
