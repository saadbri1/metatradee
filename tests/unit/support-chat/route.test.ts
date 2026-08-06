/**
 * POST /api/support-chat.
 *
 * THE BOUNDARY, not the answer — `answer.test.ts` covers what gets said. What
 * matters here is that the endpoint refuses what it should refuse and says
 * nothing it should not:
 *
 *   A malformed body gets a code, never a Zod issue list. Echoing validation
 *   issues back would reflect the submitted content — including anything the
 *   sender pasted — straight into a response.
 *
 *   An unbounded conversation is rejected before it reaches a model, because a
 *   turn can cost money.
 *
 *   A thrown error surfaces as `server_error` and nothing else. Provider
 *   exceptions carry request content, and this response is public.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const composeAnswer = vi.hoisted(() => vi.fn());
vi.mock('@/features/support-chat/server/answer', () => ({ composeAnswer }));

const headersMock = vi.hoisted(() => vi.fn());
vi.mock('next/headers', () => ({ headers: headersMock }));

const { POST } = await import('@/app/api/support-chat/route');

const REPLY = {
  reply: 'An approved answer.',
  source: 'knowledge',
  topicId: 'what_is',
  suggestEscalation: false,
  href: null,
};

/** Each test gets its own origin so the shared rate-limit map cannot bleed. */
let originCounter = 0;
function request(body: unknown): Request {
  originCounter += 1;
  headersMock.mockResolvedValue(new Headers({ 'x-forwarded-for': `10.0.0.${originCounter}` }));
  return new Request('http://localhost:3000/api/support-chat', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const VALID = { locale: 'en', messages: [{ role: 'user', content: 'What is MetaTradee?' }] };

beforeEach(() => {
  composeAnswer.mockReset();
  composeAnswer.mockResolvedValue(REPLY);
});

describe('a valid turn', () => {
  it('returns the composed reply', async () => {
    const response = await POST(request(VALID));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(REPLY);
  });

  it('is never cached — a cached support answer is a wrong one', async () => {
    const response = await POST(request(VALID));
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

describe('invalid input is refused before anything is composed', () => {
  it.each([
    ['a body that is not JSON', 'not json at all'],
    ['a missing locale', { messages: VALID.messages }],
    ['an unsupported locale', { locale: 'de', messages: VALID.messages }],
    ['no messages', { locale: 'en', messages: [] }],
    ['an empty message', { locale: 'en', messages: [{ role: 'user', content: '' }] }],
    ['an unknown role', { locale: 'en', messages: [{ role: 'system', content: 'hi' }] }],
  ])('rejects %s', async (_label, body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
    expect(composeAnswer).not.toHaveBeenCalled();
  });

  it('rejects an oversized message', async () => {
    const response = await POST(
      request({ locale: 'en', messages: [{ role: 'user', content: 'x'.repeat(1_001) }] }),
    );
    expect(response.status).toBe(400);
    expect(composeAnswer).not.toHaveBeenCalled();
  });

  it('rejects a conversation longer than the cap', async () => {
    const messages = Array.from({ length: 21 }, () => ({ role: 'user', content: 'hello there' }));
    const response = await POST(request({ locale: 'en', messages }));
    expect(response.status).toBe(400);
    expect(composeAnswer).not.toHaveBeenCalled();
  });

  it('never returns the submitted content in the error body', async () => {
    const secret = 'sk-live-ABCDEFGHIJKLMNOPQRST';
    const response = await POST(
      request({ locale: 'nope', messages: [{ role: 'user', content: secret }] }),
    );
    expect(JSON.stringify(await response.json())).not.toContain(secret);
  });
});

describe('rate limiting', () => {
  it('throttles a single origin once it exceeds the window', async () => {
    headersMock.mockResolvedValue(new Headers({ 'x-forwarded-for': '203.0.113.7' }));
    const send = () =>
      POST(
        new Request('http://localhost:3000/api/support-chat', {
          method: 'POST',
          body: JSON.stringify(VALID),
        }),
      );

    /*
     * 60 per five minutes, not 20. An IP is not a person — an office or a
     * mobile carrier behind CGNAT shares one, and a conversation is inherently
     * many requests where a contact-form submission is one. The browser suite
     * exhausted the old cap in a single pass, which is a mild version of what a
     * shared exit node would do to real visitors.
     */
    for (let i = 0; i < 60; i++) expect((await send()).status).toBe(200);

    const blocked = await send();
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: 'rate_limited' });
  });
});

describe('failures stay opaque', () => {
  it('reports a server error without leaking the thrown detail', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    composeAnswer.mockRejectedValue(new Error('provider said: sk-live-SECRETKEYVALUE'));

    const response = await POST(request(VALID));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'server_error' });

    // Only the error NAME is logged, never its message.
    const logged = consoleError.mock.calls.flat().join(' ');
    expect(logged).not.toContain('SECRETKEYVALUE');
    consoleError.mockRestore();
  });
});
