/**
 * OpenAI Chat Completions adapter — fetch only, no SDK. Pending-live.
 * Also drives OpenRouter (OpenAI-compatible) via subclassing.
 */
import { AIError, type AIGenerateRequest, type AIGenerateResult, type AIProvider } from './types';
import { errorFromStatus, fetchWithTimeout, withRetry } from './retry';

interface ChatChoice {
  message?: { content?: string };
  finish_reason?: string;
}
interface ChatResponse {
  choices?: ChatChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** Shared implementation for OpenAI-compatible /chat/completions endpoints. */
export class OpenAICompatProvider implements AIProvider {
  readonly name: 'openai' | 'openrouter';
  readonly model: string;
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly extraHeaders: Record<string, string>;

  constructor(
    name: 'openai' | 'openrouter',
    apiKey: string,
    model: string,
    endpoint: string,
    extraHeaders: Record<string, string> = {},
  ) {
    this.name = name;
    this.apiKey = apiKey;
    this.model = model;
    this.endpoint = endpoint;
    this.extraHeaders = extraHeaders;
  }

  async generate(req: AIGenerateRequest): Promise<AIGenerateResult> {
    return withRetry(async () => {
      const res = await fetchWithTimeout(
        this.endpoint,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${this.apiKey}`,
            ...this.extraHeaders,
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: req.maxTokens ?? 1024,
            temperature: req.temperature ?? 0.2,
            messages: [
              { role: 'system', content: req.system },
              ...req.messages.map((m) => ({ role: m.role, content: m.content })),
            ],
          }),
        },
        req.timeoutMs ?? 30_000,
        this.name,
      );
      if (!res.ok) throw errorFromStatus(res.status, await res.text(), this.name);
      const json = (await res.json()) as ChatResponse;
      const choice = json.choices?.[0];
      const text = choice?.message?.content ?? '';
      if (!text) throw new AIError('invalid_response', 'Empty completion', this.name);
      return {
        text,
        usage: {
          input: json.usage?.prompt_tokens ?? 0,
          output: json.usage?.completion_tokens ?? 0,
        },
        model: this.model,
        provider: this.name,
        finishReason: choice?.finish_reason === 'length' ? 'length' : 'stop',
      };
    });
  }
}

export class OpenAIProvider extends OpenAICompatProvider {
  constructor(apiKey: string, model: string) {
    super('openai', apiKey, model, 'https://api.openai.com/v1/chat/completions');
  }
}

export class OpenRouterProvider extends OpenAICompatProvider {
  constructor(apiKey: string, model: string) {
    super('openrouter', apiKey, model, 'https://openrouter.ai/api/v1/chat/completions', {
      'x-title': 'MetaTradee AI Coach',
    });
  }
}
