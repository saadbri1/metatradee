/**
 * Vendor-neutral types for the Interactive Brokers Flex Web Service.
 *
 * Pure declarations: no network, no secrets, no React. Everything above the
 * client consumes these shapes, so a future per-user connection — or a
 * different statement provider entirely — can be introduced without changing
 * domain code.
 */

/**
 * The safe failure categories this integration may expose.
 *
 * A category is the ONLY failure detail that ever leaves the server. Raw IBKR
 * XML, error text, tokens, query ids and stack traces are all discarded before
 * a result is returned.
 */
export const FLEX_ERROR_CATEGORIES = [
  'missing_configuration',
  'invalid_token',
  'expired_token',
  'invalid_query',
  'report_pending',
  'pacing_limit',
  'malformed_xml',
  'ibkr_unavailable',
  'network',
  'unknown',
] as const;

export type FlexErrorCategory = (typeof FLEX_ERROR_CATEGORIES)[number];

/** Fixed, safe explanations. Never provider text. */
export const FLEX_CATEGORY_MESSAGE: Record<FlexErrorCategory, string> = {
  missing_configuration: 'The IBKR Flex credentials are not configured for this environment.',
  invalid_token: 'The Flex token was rejected as invalid.',
  expired_token: 'The Flex token has expired and must be regenerated.',
  invalid_query: 'The Flex query id was rejected as invalid or is not accessible to this token.',
  report_pending: 'IBKR is still generating the report. Try again shortly.',
  pacing_limit: 'IBKR is rate limiting requests. Try again shortly.',
  malformed_xml: 'The IBKR response could not be parsed as a valid Flex report.',
  ibkr_unavailable: 'IBKR reported that the statement could not be produced right now.',
  network: 'IBKR could not be reached, or the request timed out.',
  unknown: 'IBKR returned an unrecognised error.',
};

/**
 * Normalized integration failure. Callers branch on `.category`, never on a
 * provider payload. The message is drawn from the fixed table above, so an
 * error is always safe to surface.
 */
export class FlexError extends Error {
  readonly category: FlexErrorCategory;
  readonly retryable: boolean;

  constructor(category: FlexErrorCategory, retryable = false) {
    super(FLEX_CATEGORY_MESSAGE[category]);
    this.name = 'FlexError';
    this.category = category;
    this.retryable = retryable;
  }
}

/**
 * One set of Flex credentials.
 *
 * Deliberately a VALUE passed in, not a global read: this is the seam that lets
 * a future user-owned connection supply its own decrypted token and query id.
 */
export interface FlexCredentials {
  token: string;
  queryId: string;
}

/**
 * A single execution as IBKR reported it. Fields are preserved as supplied and
 * are `null` when IBKR omitted them — never defaulted to zero, because a
 * missing commission and a zero commission are different facts.
 *
 * This phase does not persist any of it.
 */
export interface FlexTrade {
  /** IBKR execution identifier, when supplied. */
  execId: string | null;
  /** IBKR trade identifier, when supplied. */
  tradeId: string | null;
  symbol: string | null;
  assetCategory: string | null;
  currency: string | null;
  direction: 'buy' | 'sell' | null;
  quantity: number | null;
  price: number | null;
  commission: number | null;
  /** ISO 8601 UTC, derived from IBKR's `dateTime`. Null when unparseable. */
  executedAt: string | null;
}

/** The reporting window IBKR stamped on the statement, when present. */
export interface FlexPeriod {
  from: string | null;
  to: string | null;
}

/** A parsed Flex statement. Account ids here are RAW and must be masked. */
export interface FlexReport {
  /** Raw account id straight from the XML — never leaves the server unmasked. */
  accountId: string | null;
  queryName: string | null;
  period: FlexPeriod;
  whenGenerated: string | null;
  trades: FlexTrade[];
}

/** Outcome of a SendRequest call. */
export interface FlexRequestHandle {
  referenceCode: string;
}
