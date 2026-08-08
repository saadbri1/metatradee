/**
 * Contract specifications for the position-size calculators.
 *
 * ONE STANDARD LOT, EXPRESSED AS UNITS OF THE BASE INSTRUMENT. That single
 * number is all the position-size formula needs, because the loss on a trade is
 * `price distance × units`. Quoting it this way keeps forex, metals and indices
 * on the same arithmetic instead of needing a special case each.
 *
 * THE PIP IS A DISPLAY CONVENIENCE, NOT THE MATHS. The calculator works in
 * price distance throughout; `pipSize` exists only so a trader who thinks in
 * pips can enter a stop in pips and see it converted. Doing the calculation in
 * pips is where "how many pips is a gold dollar" confusion comes from.
 *
 * THE HONEST LIMIT: these figures are the widely used retail conventions, and a
 * broker may differ — mini and micro accounts in particular. The calculator
 * shows the contract size it used and lets it be overridden, rather than
 * presenting one broker's convention as universal truth.
 */

export interface Instrument {
  /** Stable id, also the URL slug fragment where one exists. */
  id: string;
  /** Display symbol as a trader would write it. */
  symbol: string;
  label: string;
  /** Units of the base instrument in ONE standard lot. */
  contractSize: number;
  /** Price movement of one pip, for the pips ⇄ price conversion. */
  pipSize: number;
  /** What a pip is called for this instrument, for the interface copy. */
  pipLabel: string;
  /**
   * Currency the instrument is quoted in. The calculator is exact when this
   * matches the account currency and says so plainly when it may not.
   */
  quoteCurrency: string;
  note?: string;
}

export const INSTRUMENTS: readonly Instrument[] = [
  {
    id: 'xauusd',
    symbol: 'XAUUSD',
    label: 'Gold vs US Dollar',
    // 100 troy ounces per standard lot — the common retail gold contract.
    contractSize: 100,
    pipSize: 0.1,
    pipLabel: 'pip ($0.10)',
    quoteCurrency: 'USD',
    note: 'Gold is commonly quoted with a $0.10 pip. Many traders think in whole dollars instead, so the calculator accepts either.',
  },
  {
    id: 'eurusd',
    symbol: 'EURUSD',
    label: 'Euro vs US Dollar',
    contractSize: 100_000,
    pipSize: 0.0001,
    pipLabel: 'pip (0.0001)',
    quoteCurrency: 'USD',
  },
  {
    id: 'gbpusd',
    symbol: 'GBPUSD',
    label: 'British Pound vs US Dollar',
    contractSize: 100_000,
    pipSize: 0.0001,
    pipLabel: 'pip (0.0001)',
    quoteCurrency: 'USD',
  },
  {
    id: 'audusd',
    symbol: 'AUDUSD',
    label: 'Australian Dollar vs US Dollar',
    contractSize: 100_000,
    pipSize: 0.0001,
    pipLabel: 'pip (0.0001)',
    quoteCurrency: 'USD',
  },
  {
    id: 'xagusd',
    symbol: 'XAGUSD',
    label: 'Silver vs US Dollar',
    contractSize: 5_000,
    pipSize: 0.01,
    pipLabel: 'pip (0.01)',
    quoteCurrency: 'USD',
  },
  {
    id: 'usoil',
    symbol: 'USOIL',
    label: 'WTI Crude Oil',
    contractSize: 1_000,
    pipSize: 0.01,
    pipLabel: 'tick (0.01)',
    quoteCurrency: 'USD',
  },
] as const;

export function instrumentById(id: string): Instrument | undefined {
  return INSTRUMENTS.find((i) => i.id === id);
}
