/**
 * Dated futures contract validation (Databento raw symbology).
 *
 * APPROVED POLICY: dated contracts ONLY. Continuous (`.v.` / `.n.` / `.c.`) and
 * parent (`ES`, `ES.FUT`) symbols are rejected, and a parent is NEVER silently
 * mapped to a contract — the caller must name the exact instrument. Rationale is
 * recorded in docs/CHART_AND_BACKTESTING_DESIGN.md: a dated contract is the
 * instrument that actually traded, with no synthetic rollover seam.
 *
 * Format verified against Databento's parent-symbology example output, which
 * lists `raw_symbol` values ESM5, ESU5, ESZ5, ESH6, ESM6, ESU6, ESZ6 …
 * (https://databento.com/docs/examples/symbology/parent-symbology) — i.e.
 * ROOT + CME month code + single-digit year.
 *
 * Pure module: no network, no vendor SDK, no secrets. Safe to unit test.
 */

/** Roots approved for this milestone. Order is longest-first for prefix safety. */
export const APPROVED_ROOTS = ['MES', 'MNQ', 'ES', 'NQ'] as const;
export type ApprovedRoot = (typeof APPROVED_ROOTS)[number];

/** Official CME futures month codes (Jan→Dec). */
export const CME_MONTH_CODES = [
  'F',
  'G',
  'H',
  'J',
  'K',
  'M',
  'N',
  'Q',
  'U',
  'V',
  'X',
  'Z',
] as const;
export type CmeMonthCode = (typeof CME_MONTH_CODES)[number];

/**
 * ROOT + month code + single year digit, anchored and case-sensitive.
 * Anchoring is what rejects whitespace and injection attempts outright.
 */
const DATED_SYMBOL_RE = new RegExp(
  `^(${APPROVED_ROOTS.join('|')})([${CME_MONTH_CODES.join('')}])([0-9])$`,
);

export interface DatedContract {
  symbol: string;
  root: ApprovedRoot;
  monthCode: CmeMonthCode;
  /** Single digit as published by Databento (e.g. '5' in ESZ5). */
  yearDigit: string;
}

/**
 * Parse a dated contract symbol. Returns null for ANY input that is not an
 * exactly-formed approved dated contract — including parent, continuous,
 * unsupported roots, bad month codes, and padded/encoded input.
 */
export function parseDatedContract(input: unknown): DatedContract | null {
  if (typeof input !== 'string') return null;
  const m = DATED_SYMBOL_RE.exec(input);
  if (!m) return null;
  return {
    symbol: input,
    root: m[1] as ApprovedRoot,
    monthCode: m[2] as CmeMonthCode,
    yearDigit: m[3]!,
  };
}

export function isDatedContract(input: unknown): input is string {
  return parseDatedContract(input) !== null;
}
