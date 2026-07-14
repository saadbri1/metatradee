/**
 * Coach orchestration. Pure w.r.t. the provider — pass any `AIProvider` (real or
 * mock) and the flow is identical, which is what makes provider-swap a no-op for
 * coaching logic. The pipeline is:
 *   1. detect patterns deterministically (patterns.ts, reuses 9.8 engines)
 *   2. assemble evidence + confidence from engine facts (evidence.ts)
 *   3. render an injection-safe, versioned prompt (prompts/)
 *   4. call the provider for NARRATIVE ONLY (never numbers)
 *   5. scrub the narrative for unsafe content (safety.ts)
 *   6. return an evidence-grounded CoachReview
 * The model contributes prose; every figure originates in the engines.
 */
import { reviewTemplate } from './prompts';
import type { DataSection } from './prompts';
import { detectPatterns, type PatternInputs } from './patterns';
import { buildEvidence } from './evidence';
import { enforceSafety } from './safety';
import type { AIProvider } from './providers';
import {
  SCOPE_TASK,
  type CoachInsight,
  type CoachReview,
  type ReviewScope,
  type SupportingFact,
} from './types';

export interface ReviewBuildInput {
  scope: ReviewScope;
  targetId: string;
  /** Engine-computed figures to cite (already formatted). */
  facts: SupportingFact[];
  /** Inputs for deterministic pattern detection (trades + 9.10/9.9 signals). */
  patternInputs: PatternInputs;
  /** Untrusted user notes/journal for this scope (delimited + sanitized). */
  userData: DataSection[];
  /** Trades in scope — drives confidence (sample size). */
  sampleSize: number;
  /** Human title for the prompt/UI, e.g. "Weekly review". */
  title: string;
}

const MAX_TOKENS_BY_SCOPE: Record<ReviewScope, number> = {
  trade: 512,
  daily: 640,
  weekly: 900,
  monthly: 1100,
};

/** Generate one evidence-grounded review using the supplied provider. */
export async function buildReview(
  input: ReviewBuildInput,
  provider: AIProvider,
): Promise<CoachReview> {
  const patterns = detectPatterns(input.patternInputs);

  // Referenced trades = union of pattern refs (EvidenceLink targets).
  const referenced = [...new Set(patterns.flatMap((p) => p.referencedTradeIds))];
  const evidence = buildEvidence(input.facts, referenced, input.sampleSize);

  const { system, user } = reviewTemplate.render({
    title: input.title,
    supportingData: input.facts.map((f) => `${f.label}: ${f.value}`),
    detectedPatterns: patterns.map((p) => p.summary),
    userData: input.userData,
  });

  const result = await provider.generate({
    system,
    messages: [{ role: 'user', content: user }],
    maxTokens: MAX_TOKENS_BY_SCOPE[input.scope],
    temperature: 0.2,
  });

  const scrubbed = enforceSafety(result.text);

  const insight: CoachInsight = {
    id: `${input.scope}-${input.targetId}-primary`,
    scope: input.scope,
    narrative: scrubbed.text,
    evidence,
    patterns,
  };

  return {
    scope: input.scope,
    targetId: input.targetId,
    insights: [insight],
    model: result.model,
    provider: result.provider,
    usage: result.usage,
    mock: result.provider === 'mock',
    generatedAt: new Date().toISOString(),
  };
}

/** Router task class for a scope (re-exported for the server layer). */
export function taskForScope(scope: ReviewScope) {
  return SCOPE_TASK[scope];
}
