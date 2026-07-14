/**
 * Market-timing classification by holding duration (reuses 9.6 duration_seconds).
 * Thresholds documented; adjust to FRS.
 */
export const STYLE_THRESHOLDS = {
  scalpMaxSeconds: 60 * 60, // < 1 hour
  dayMaxSeconds: 24 * 60 * 60, // < 1 day
} as const;

export type TradeStyle = 'scalping' | 'day_trading' | 'swing_trading' | 'unknown';

export function classifyTradeStyle(seconds: number | null): TradeStyle {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return 'unknown';
  if (seconds < STYLE_THRESHOLDS.scalpMaxSeconds) return 'scalping';
  if (seconds < STYLE_THRESHOLDS.dayMaxSeconds) return 'day_trading';
  return 'swing_trading';
}
