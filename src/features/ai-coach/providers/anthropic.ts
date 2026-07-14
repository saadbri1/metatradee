/**
 * Anthropic Messages API adapter — fetch only, no SDK. Live calls are
 * pending-live (need a real ANTHROPIC_API_KEY); the request/response mapping and
 * error normalization are unit-tested with a stubbed fetch.
 */
import { AIError, type AIGenerateRequest, type AIGenerateResult, type AIProvider } from './types';
import { errorFromStatus, fetchWithTimeout, withRetry } from './retry';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic' as const;
  readonly model: string;
  private readonly apiKey: string;
  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(req: AIGenerateRequest): Promise<AIGenerateResult> {
    return withRetry(async () => {
      const res = await fetchWithTimeout(
        ENDPOINT,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: this.model,
            system: req.system,
            max_tokens: req.maxTokens ?? 1024,
            temperature: req.temperature ?? 0.2,
            messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
          }),
        },
        req.timeoutMs ?? 30_000,
        'anthropic',
      );
      if (!res.ok) throw errorFromStatus(res.status, await res.text(), 'anthropic');
      const json = (await res.json()) as {
        content?: { type: string; text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
        stop_reason?: string;
      };
      const text = (json.content ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('');
      if (!text) throw new AIError('invalid_response', 'Empty completion', 'anthropic');
      return {
        text,
        usage: {
          input: json.usage?.input_tokens ?? 0,
          output: json.usage?.output_tokens ?? 0,
        },
        model: this.model,
        provider: 'anthropic',
        finishReason: json.stop_reason === 'max_tokens' ? 'length' : 'stop',
      };
    });
  }
}
