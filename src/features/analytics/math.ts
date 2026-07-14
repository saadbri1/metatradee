/**
 * Small numeric helpers for the analytics engine. Pure; guard against the
 * NaN/Infinity/empty-input cases so no bad number ever reaches the UI.
 */

export function sum(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

export function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return sum(xs) / xs.length;
}

/** Sample standard deviation (n-1). null when n < 2 or degenerate. */
export function stdev(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = sum(xs) / xs.length;
  const variance = sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1);
  return Math.sqrt(variance);
}

/** Downside deviation vs a target (default 0). null when < 2 samples. */
export function downsideDeviation(xs: number[], target = 0): number | null {
  if (xs.length < 2) return null;
  const below = xs.map((x) => Math.min(0, x - target) ** 2);
  return Math.sqrt(sum(below) / (xs.length - 1));
}

/** Round to `dp` decimals, guarding float error. null passes through. */
export function round(n: number | null, dp = 2): number | null {
  if (n === null || !Number.isFinite(n)) return null;
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** Safe division: null on zero/invalid denominator. */
export function safeDiv(a: number, b: number): number | null {
  if (b === 0 || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  const r = a / b;
  return Number.isFinite(r) ? r : null;
}
