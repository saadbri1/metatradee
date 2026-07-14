/**
 * Deterministic mock provider. Used in CI (no live model calls) and as the
 * safe fallback when no API key is configured. It is *content-agnostic*: it
 * NEVER interprets instructions embedded in the prompt, which is exactly why
 * prompt-injection in user data cannot change its behavior. Output is a fixed,
 * evidence-neutral narrative — the real numbers/evidence are attached by the
 * coach layer, not invented here.
 */
import type { AIGenerateRequest, AIGenerateResult, AIProvider } from './types';

/** Rough token estimate (≈4 chars/token) — enough for cost accounting in tests. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class MockProvider implements AIProvider {
  readonly name = 'mock' as const;
  readonly model: string;
  constructor(model = 'mock-deterministic-v1') {
    this.model = model;
  }

  async generate(req: AIGenerateRequest): Promise<AIGenerateResult> {
    const last = req.messages[req.messages.length - 1]?.content ?? '';
    // Fixed, safe narrative. Deliberately ignores any text inside the prompt so
    // that "ignore previous instructions"-style injections are inert.
    const text =
      'Your data shows patterns worth reflecting on. The figures referenced ' +
      'below are computed from your own trades. Consider reviewing them, and ' +
      'decide what fits your plan — these are observations, not instructions.';
    return {
      text,
      usage: { input: estimateTokens(req.system + last), output: estimateTokens(text) },
      model: this.model,
      provider: 'mock',
      finishReason: 'stop',
    };
  }
}
