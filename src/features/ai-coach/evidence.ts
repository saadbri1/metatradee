/**
 * Evidence + confidence. Numbers are NEVER computed here — callers pass values
 * already produced by the 9.8/9.9/9.11 engines; this module only formats them
 * into facts and derives a data-sufficiency confidence. Confidence reflects how
 * much data backs a claim, not how "sure" a model is.
 */
import type { Evidence, SupportingFact } from './types';

/** Build a display+prompt fact from an engine value (kept null-honest). */
export function fact(label: string, raw: number | null, unit = ''): SupportingFact {
  const value = raw === null ? 'n/a' : `${formatNumber(raw)}${unit}`;
  return { label, value, raw };
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString('en-US');
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * Data-sufficiency confidence (0–100) from sample size, with a plain note when
 * the sample is small. Deliberately conservative: < 5 trades is never "high".
 */
export function computeConfidence(sampleSize: number): { confidence: number; note: string | null } {
  if (sampleSize <= 0) {
    return { confidence: 0, note: 'No trades in scope — not enough data to draw conclusions.' };
  }
  if (sampleSize < 5) {
    return {
      confidence: 25,
      note: `Only ${sampleSize} trade${sampleSize === 1 ? '' : 's'} in scope — treat this as a very early signal.`,
    };
  }
  if (sampleSize < 20) {
    return {
      confidence: 55,
      note: `Based on ${sampleSize} trades — a small sample, so patterns may not hold.`,
    };
  }
  if (sampleSize < 50) return { confidence: 75, note: null };
  return { confidence: 90, note: null };
}

/** Assemble an Evidence object from facts + referenced trades + sample size. */
export function buildEvidence(
  facts: SupportingFact[],
  referencedTradeIds: string[],
  sampleSize: number,
): Evidence {
  const { confidence, note } = computeConfidence(sampleSize);
  return { facts, referencedTradeIds, confidence, confidenceNote: note };
}
