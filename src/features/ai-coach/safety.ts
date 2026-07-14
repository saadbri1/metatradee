/**
 * Output guardrail. Defense-in-depth on top of the system prompt: even if a
 * model ignores instructions (or a future provider misbehaves), coach output is
 * scanned for financial-advice / price-prediction / autopilot language before it
 * ever reaches the user. Detected content is replaced, not silently trusted.
 */

const UNSAFE_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b(buy|sell|short|long|enter|exit)\s+(now|this|it|the\s+\w+)\b/i, label: 'trade call' },
  { re: /\byou should (buy|sell|short|go long|go short|hold)\b/i, label: 'trade directive' },
  {
    re: /\b(price|it|the market|this stock) will (go|rise|fall|drop|rally|hit|reach)\b/i,
    label: 'price prediction',
  },
  { re: /\bguaranteed (profit|return|win|gain)s?\b/i, label: 'guarantee' },
  {
    re: /\bI (?:have |'ve )?(placed|executed|entered|closed) (?:a |the )?(?:order|trade|position)\b/i,
    label: 'autopilot claim',
  },
];

export interface SafetyResult {
  safe: boolean;
  violations: string[];
  /** Text with offending sentences replaced by a neutral, on-policy line. */
  text: string;
}

const REPLACEMENT =
  '[A suggestion here was removed because the coach does not give buy/sell calls or price predictions. Review your data and decide what fits your plan.]';

/** Scan + scrub. Splits on sentence boundaries so only offending parts are cut. */
export function enforceSafety(text: string): SafetyResult {
  const violations: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  const cleaned = sentences.map((s) => {
    const hit = UNSAFE_PATTERNS.find((p) => p.re.test(s));
    if (hit) {
      violations.push(hit.label);
      return REPLACEMENT;
    }
    return s;
  });
  return { safe: violations.length === 0, violations, text: cleaned.join(' ') };
}
