/**
 * Google Gemini (generateContent) adapter — fetch only, no SDK. Pending-live.
 */
import { AIError, type AIGenerateRequest, type AIGenerateResult, type AIProvider } from './types';
import { errorFromStatus, fetchWithTimeout, withRetry } from './retry';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini' as const;
  readonly model: string;
  private readonly apiKey: string;
  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(req: AIGenerateRequest): Promise<AIGenerateResult> {
    // Key travels in a header, never the URL/query string (privacy rule).
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    return withRetry(async () => {
      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: req.system }] },
            contents: req.messages.map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }],
            })),
            generationConfig: {
              temperature: req.temperature ?? 0.2,
              maxOutputTokens: req.maxTokens ?? 1024,
            },
          }),
        },
        req.timeoutMs ?? 30_000,
        'gemini',
      );
      if (!res.ok) throw errorFromStatus(res.status, await res.text(), 'gemini');
      const json = (await res.json()) as GeminiResponse;
      const cand = json.candidates?.[0];
      const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('');
      if (!text) throw new AIError('invalid_response', 'Empty completion', 'gemini');
      return {
        text,
        usage: {
          input: json.usageMetadata?.promptTokenCount ?? 0,
          output: json.usageMetadata?.candidatesTokenCount ?? 0,
        },
        model: this.model,
        provider: 'gemini',
        finishReason: cand?.finishReason === 'MAX_TOKENS' ? 'length' : 'stop',
      };
    });
  }
}
