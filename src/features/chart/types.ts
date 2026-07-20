/**
 * Price-chart domain types (Phase 12.4 — chart workspace foundation).
 *
 * Deliberately VENDOR-FREE: nothing here imports the charting library, so the
 * domain (and everything that consumes it) survives swapping or removing that
 * dependency. Per docs/PROJECT_STRUCTURE.md rule 5, domain code never imports a
 * vendor SDK; the adapter lives in `provider/lightweight-chart-provider.ts`.
 *
 * See docs/CHART_AND_BACKTESTING_DESIGN.md §3. Provider I/O and replay control
 * remain separate feature layers; this module only defines their shared bar.
 */

/** A single OHLCV bar. `time` is a Unix timestamp in SECONDS (UTC). */
export interface Candle {
  /** Unix seconds, UTC. Seconds (not ms) is the charting convention. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Traded volume for the bar. */
  volume: number;
}

/**
 * Where a candle series came from. Guards against passing off dev data as real.
 *
 * Only `'fixture'` exists because `CandleSeries` is now a TEST-ONLY container:
 * the production path carries provenance on the API response instead (its
 * `provider` field), so real candles never travel in this shape.
 */
export type CandleSource = 'fixture';

export interface CandleSeries {
  /** Instrument label, e.g. "DEMO/USD". Never a real ticker for fixtures. */
  symbol: string;
  /** Bar interval label, e.g. "1h". Display-only at this milestone. */
  interval: string;
  /**
   * Provenance. Always `'fixture'` — see `CandleSource`. Real provider data
   * does not use this container, so generated candles can never be mistaken
   * for market prices by anything reading this field.
   */
  source: CandleSource;
  candles: Candle[];
}

/** Derived, display-only summary used by the accessible text alternative. */
export interface CandleSummary {
  count: number;
  first: Candle | null;
  last: Candle | null;
  high: number | null;
  low: number | null;
  /** close(last) - open(first). Null when the series is empty. */
  change: number | null;
  /** Percentage change vs the first open. Null when empty or open is 0. */
  changePercent: number | null;
  totalVolume: number;
}

/** Loading/empty/error/ready are explicit so every state is designed, not implied. */
export type ChartStatus = 'loading' | 'empty' | 'error' | 'ready';
