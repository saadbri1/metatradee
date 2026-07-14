/**
 * Model-selection router. The ONLY place that knows which vendor is active and
 * which model serves which task. Coaching logic calls `getProviderForTask(task)`
 * and receives an `AIProvider` — it never imports a vendor adapter directly, so
 * switching providers is a config change here (or env), nothing more.
 *
 * Cost strategy (AI Architecture): cheap model for high-volume per-trade/daily
 * summaries, frontier model for weekly/monthly synthesis. Both configurable via
 * AI_MODEL_CHEAP / AI_MODEL_FRONTIER — never hardcoded in feature code.
 *
 * LOCAL-MODEL SEAM (documented, not implemented): add a `LocalProvider`
 * implementing `AIProvider` that POSTs to a self-hosted OpenAI-compatible
 * endpoint (e.g. Ollama/vLLM), register the 'local' case below, and set
 * AI_PROVIDER=local. No coaching-logic change is required.
 */
import { serverEnv } from '@/config/env';
import type { AIProvider, AIProviderName } from './types';
import { MockProvider } from './mock';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider, OpenRouterProvider } from './openai';
import { GeminiProvider } from './gemini';

/** Coarse task classes drive the cheap-vs-frontier decision. */
export type CoachTask = 'trade_review' | 'daily_review' | 'weekly_review' | 'monthly_review';

const FRONTIER_TASKS: ReadonlySet<CoachTask> = new Set(['weekly_review', 'monthly_review']);

/** Sensible built-in model ids per vendor; overridden by env when present. */
const DEFAULT_MODELS: Record<
  Exclude<AIProviderName, 'mock'>,
  { cheap: string; frontier: string }
> = {
  anthropic: { cheap: 'claude-haiku-4-5-20251001', frontier: 'claude-opus-4-8' },
  openai: { cheap: 'gpt-4o-mini', frontier: 'gpt-4o' },
  gemini: { cheap: 'gemini-1.5-flash', frontier: 'gemini-1.5-pro' },
  openrouter: { cheap: 'anthropic/claude-haiku-4-5', frontier: 'anthropic/claude-opus-4' },
};

interface ResolvedConfig {
  provider: AIProviderName;
  apiKey: string;
  cheap: string;
  frontier: string;
}

/** Resolve the active provider + model tiers from validated server env. */
export function resolveConfig(): ResolvedConfig {
  const env = serverEnv();
  const keyByProvider: Record<string, string | undefined> = {
    anthropic: env.ANTHROPIC_API_KEY || undefined,
    openai: env.OPENAI_API_KEY || undefined,
    gemini: env.GOOGLE_AI_API_KEY || undefined,
    openrouter: env.OPENROUTER_API_KEY || undefined,
  };

  // Explicit choice wins; otherwise the first provider with a key; else mock.
  let provider: AIProviderName = env.AI_PROVIDER ?? 'mock';
  if (!env.AI_PROVIDER) {
    const withKey = (['anthropic', 'openai', 'gemini', 'openrouter'] as const).find(
      (p) => keyByProvider[p],
    );
    provider = withKey ?? 'mock';
  }
  // A chosen real provider missing its key degrades safely to mock (never crash,
  // never leak). Callers can detect mock via the returned provider name.
  if (provider !== 'mock' && !keyByProvider[provider]) provider = 'mock';

  if (provider === 'mock') return { provider, apiKey: '', cheap: 'mock', frontier: 'mock' };
  const defaults = DEFAULT_MODELS[provider];
  return {
    provider,
    apiKey: keyByProvider[provider] as string,
    cheap: env.AI_MODEL_CHEAP ?? defaults.cheap,
    frontier: env.AI_MODEL_FRONTIER ?? defaults.frontier,
  };
}

function build(provider: AIProviderName, apiKey: string, model: string): AIProvider {
  switch (provider) {
    case 'anthropic':
      return new AnthropicProvider(apiKey, model);
    case 'openai':
      return new OpenAIProvider(apiKey, model);
    case 'openrouter':
      return new OpenRouterProvider(apiKey, model);
    case 'gemini':
      return new GeminiProvider(apiKey, model);
    case 'mock':
    default:
      return new MockProvider(model);
  }
}

/** Pick the provider+model tier appropriate for `task`. */
export function getProviderForTask(task: CoachTask, cfg = resolveConfig()): AIProvider {
  const model = FRONTIER_TASKS.has(task) ? cfg.frontier : cfg.cheap;
  return build(cfg.provider, cfg.apiKey, model);
}

/** True when no real key is configured — surfaced to the UI as a soft notice. */
export function isMockActive(cfg = resolveConfig()): boolean {
  return cfg.provider === 'mock';
}
