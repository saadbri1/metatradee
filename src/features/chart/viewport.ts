/**
 * Pure normal-mode chart viewport model.
 *
 * WHY THIS EXISTS: `fitContent()` fits the ENTIRE loaded domain into the
 * visible width. A complete regular-hours day is ~390 one-minute candles, so
 * fitting it into ~1300px leaves ~3.3px per candle — one-minute bars that read
 * like compressed hourly bars. The domain must stay complete while the VISIBLE
 * window stays bounded, exactly as the replay viewport already does.
 *
 * This module knows only logical candle indexes: no React, no chart vendor, no
 * DOM. The adapter renders the range it is given.
 */
import type { ChartLogicalRange } from './provider';

/**
 * Bars visible at desktop width. Chosen inside the professional 160–220 band;
 * at ~1300px this yields roughly 7px per candle, which reads as a real
 * one-minute candle rather than a hairline.
 */
export const NORMAL_VIEWPORT_MAX_BARS = 180;

/** Latest candle sits here across the width, leaving a modest right margin. */
export const NORMAL_VIEWPORT_CURSOR_POSITION = 0.76;

/**
 * The initial logical range for a freshly loaded session: the most recent
 * `NORMAL_VIEWPORT_MAX_BARS` candles, with the latest bar at ~76% of the width
 * and blank workspace to its right. Older candles stay in the domain and remain
 * reachable by panning backward — they are simply not squeezed on screen.
 *
 * Returns null when there is nothing to show, so the caller can skip the call.
 */
export function initialLogicalRange(candleCount: number): ChartLogicalRange | null {
  if (!Number.isFinite(candleCount) || candleCount <= 0) return null;

  const lastIndex = Math.trunc(candleCount) - 1;
  const bars = Math.min(NORMAL_VIEWPORT_MAX_BARS, Math.trunc(candleCount));
  // Span between first and last visible bar; at least 1 so a single-candle
  // session still produces a sane, non-degenerate range.
  const span = Math.max(1, bars - 1);
  const rightWorkspaceBars =
    (span * (1 - NORMAL_VIEWPORT_CURSOR_POSITION)) / NORMAL_VIEWPORT_CURSOR_POSITION;

  return Object.freeze({
    from: lastIndex - span,
    to: lastIndex + rightWorkspaceBars,
  });
}

/** Visible bar count implied by a logical range (excludes the blank margin). */
export function visibleBarCount(range: ChartLogicalRange | null): number {
  if (!range) return 0;
  return Math.max(0, Math.round(Math.min(range.to, Math.floor(range.to)) - range.from) + 1);
}
