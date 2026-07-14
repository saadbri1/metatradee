/**
 * Provider-independent model interface (Phase 9.12 AI Coach).
 *
 * Business/coaching logic depends ONLY on these types — never on a vendor SDK.
 * Swapping Anthropic ⇄ OpenAI ⇄ Gemini ⇄ OpenRouter ⇄ a future local model is a
 * config/adapter change with zero changes to coaching logic. Every adapter
 * normalizes its transport errors into `AIError` and reports token usage.
 */

/** A single chat turn. `system` is sent separately (see AIGenerateRequest). */
export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIGenerateRequest {
  /** System prompt (safety + evidence contract). Sent out-of-band from turns. */
  system: string;
  messages: AIMessage[];
  /** Upper bound on output tokens (internal cost control, never user-facing). */
  maxTokens?: number;
  /** 0 = deterministic. Reviews default low for reproducibility. */
  temperature?: number;
  /** Per-call wall-clock budget in ms. Adapter aborts and throws on timeout. */
  timeoutMs?: number;
}

export interface AITokenUsage {
  input: number;
  output: number;
}

export interface AIGenerateResult {
  text: string;
  usage: AITokenUsage;
  /** Concrete model id that served the request (for the audit trail). */
  model: string;
  provider: AIProviderName;
  finishReason: 'stop' | 'length' | 'error';
}

export type AIProviderName = 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'mock';

export type AIErrorCode =
  'timeout' | 'rate_limit' | 'auth' | 'invalid_response' | 'provider_error' | 'network';

/** Normalized error — coaching logic branches on `.code`, not vendor payloads. */
export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly retryable: boolean;
  readonly provider: AIProviderName;
  constructor(code: AIErrorCode, message: string, provider: AIProviderName, retryable = false) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.retryable = retryable;
    this.provider = provider;
  }
}

export interface AIProvider {
  readonly name: AIProviderName;
  /** The model id this instance targets (chosen by the router per task). */
  readonly model: string;
  generate(req: AIGenerateRequest): Promise<AIGenerateResult>;
}
