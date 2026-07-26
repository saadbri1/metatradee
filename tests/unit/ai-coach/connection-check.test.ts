import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  categorizeHttpFailure,
  categorizeTransportError,
  CATEGORY_MESSAGE,
  CONNECTION_CATEGORIES,
} from '@/features/ai-coach/connection/categories';

const envMock = vi.hoisted(() => ({ OPENAI_API_KEY: 'sk-test-do-not-use' as string | undefined }));
vi.mock('@/config/env', () => ({ serverEnv: () => envMock }));
vi.mock('server-only', () => ({}));

import {
  checkOpenAIConnection,
  CONNECTION_CHECK_MODEL,
} from '@/features/ai-coach/connection/check';

/** A canned fetch Response for the probe. */
function respond(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  envMock.OPENAI_API_KEY = 'sk-test-do-not-use';
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Error categorisation
// ---------------------------------------------------------------------------

describe('failure categories', () => {
  it('maps each required category from an explicit provider code', () => {
    expect(categorizeHttpFailure(401, 'invalid_api_key')).toBe('invalid_key');
    expect(categorizeHttpFailure(403, 'permission_denied')).toBe('permission');
    expect(categorizeHttpFailure(429, 'insufficient_quota')).toBe('quota');
    expect(categorizeHttpFailure(429, 'billing_not_active')).toBe('missing_billing');
    expect(categorizeHttpFailure(404, 'model_not_found')).toBe('model_access');
  });

  it('prefers the provider code over the status when they disagree', () => {
    // A 429 is normally quota, but a billing code means billing.
    expect(categorizeHttpFailure(429, 'billing_hard_limit_reached')).toBe('missing_billing');
    // A 403 is normally permission, but this account cannot see the model.
    expect(categorizeHttpFailure(403, 'model_not_found')).toBe('model_access');
  });

  it('falls back to the status when no code is supplied', () => {
    expect(categorizeHttpFailure(401, null)).toBe('invalid_key');
    expect(categorizeHttpFailure(402, null)).toBe('missing_billing');
    expect(categorizeHttpFailure(403, null)).toBe('permission');
    expect(categorizeHttpFailure(404, null)).toBe('model_access');
    expect(categorizeHttpFailure(429, null)).toBe('quota');
    expect(categorizeHttpFailure(500, null)).toBe('network');
    expect(categorizeHttpFailure(418, null)).toBe('unknown');
  });

  it('treats every transport failure as a network problem', () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    expect(categorizeTransportError(abort)).toBe('network');
    expect(categorizeTransportError(new TypeError('fetch failed'))).toBe('network');
    expect(categorizeTransportError('nonsense')).toBe('network');
  });

  it('has a fixed safe message for every category and no others', () => {
    for (const category of CONNECTION_CATEGORIES) {
      expect(CATEGORY_MESSAGE[category]).toBeTruthy();
    }
    expect(Object.keys(CATEGORY_MESSAGE).sort()).toEqual([...CONNECTION_CATEGORIES].sort());
  });
});

// ---------------------------------------------------------------------------
// The probe itself
// ---------------------------------------------------------------------------

describe('checkOpenAIConnection', () => {
  it('makes ONE minimal Responses API request for gpt-5-mini', async () => {
    fetchSpy.mockResolvedValue(respond(200, { output: [] }));
    const result = await checkOpenAIConnection();

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gpt-5-mini');
    expect(CONNECTION_CHECK_MODEL).toBe('gpt-5-mini');
    // Output is capped so a probe can never become an expensive generation.
    expect(body.max_output_tokens).toBeLessThanOrEqual(16);
  });

  it('returns only the verdict — never model output or provider text', async () => {
    fetchSpy.mockResolvedValue(
      respond(200, { output: [{ content: [{ text: 'SECRET MODEL OUTPUT' }] }] }),
    );
    const result = await checkOpenAIConnection();

    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain('SECRET MODEL OUTPUT');
    expect(Object.keys(result).sort()).toEqual(['durationMs', 'model', 'ok']);
  });

  it('never exposes the API key, in success or in any failure', async () => {
    const key = 'sk-test-do-not-use';
    const cases: Array<() => void> = [
      () => fetchSpy.mockResolvedValue(respond(200, {})),
      () => fetchSpy.mockResolvedValue(respond(401, { error: { code: 'invalid_api_key' } })),
      // A hostile provider that echoes the key back in its error body.
      () => fetchSpy.mockResolvedValue(respond(403, { error: { code: key, message: key } })),
      () => fetchSpy.mockRejectedValue(new Error(`connect failed using ${key}`)),
    ];

    for (const setup of cases) {
      fetchSpy.mockReset();
      setup();
      const result = await checkOpenAIConnection();
      expect(JSON.stringify(result)).not.toContain(key);
    }
  });

  it('sends the key only as an Authorization header, never in the body or URL', async () => {
    fetchSpy.mockResolvedValue(respond(200, {}));
    await checkOpenAIConnection();

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(init.headers.authorization).toBe('Bearer sk-test-do-not-use');
    expect(String(url)).not.toContain('sk-test');
    expect(String(init.body)).not.toContain('sk-test');
  });

  it('reports each failure with its safe category', async () => {
    const cases: Array<[number, string | null, string]> = [
      [401, 'invalid_api_key', 'invalid_key'],
      [403, null, 'permission'],
      [429, 'insufficient_quota', 'quota'],
      [429, 'billing_not_active', 'missing_billing'],
      [404, 'model_not_found', 'model_access'],
      [503, null, 'network'],
    ];

    for (const [status, code, expected] of cases) {
      fetchSpy.mockReset();
      fetchSpy.mockResolvedValue(respond(status, code ? { error: { code } } : {}));
      const result = await checkOpenAIConnection();
      expect(result.ok).toBe(false);
      expect(result.category).toBe(expected);
      expect(result.message).toBe(CATEGORY_MESSAGE[expected as never]);
    }
  });

  it('reports a transport failure as network without throwing', async () => {
    fetchSpy.mockRejectedValue(new TypeError('fetch failed'));
    const result = await checkOpenAIConnection();
    expect(result).toMatchObject({ ok: false, category: 'network' });
  });

  it('survives a non-JSON error page without leaking its contents', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('<html>gateway error</html>');
      },
    } as unknown as Response);

    const result = await checkOpenAIConnection();
    expect(result).toMatchObject({ ok: false, category: 'network' });
    expect(JSON.stringify(result)).not.toContain('html');
  });

  it('fails closed with no request at all when the key is unset', async () => {
    envMock.OPENAI_API_KEY = undefined;
    const result = await checkOpenAIConnection();

    expect(result).toMatchObject({ ok: false, category: 'invalid_key' });
    expect(fetchSpy).not.toHaveBeenCalled(); // no billed call, no network
  });
});
