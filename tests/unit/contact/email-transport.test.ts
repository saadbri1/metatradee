/**
 * Email transport and bot protection.
 *
 * The load-bearing behaviour is that an unconfigured transport reports FAILURE.
 * Resend is not set up yet — no API key, unverified domain — so today every
 * send returns `not_configured`, and the one outcome that must be impossible is
 * a form telling a user "message sent" when nothing left the building.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MIN_FILL_MS, MAX_FILL_MS, RATE_LIMIT, verdict } from '@/features/contact/bot-protection';
import { contactRequestSchema, supportRequestSchema } from '@/features/contact/schemas';

const OK_SIGNALS = {
  honeypot: '',
  renderedAt: 1_000_000,
  now: 1_000_000 + MIN_FILL_MS + 500,
  recentSubmissions: 0,
  isDuplicate: false,
};

describe('bot protection refuses what a human would not do', () => {
  it('allows a normal submission', () => {
    expect(verdict(OK_SIGNALS)).toEqual({ allowed: true });
  });

  it('refuses any non-empty honeypot', () => {
    // A human cannot fill a field that is never rendered.
    expect(verdict({ ...OK_SIGNALS, honeypot: 'x' })).toEqual({
      allowed: false,
      reason: 'honeypot',
    });
    expect(verdict({ ...OK_SIGNALS, honeypot: '   x  ' }).allowed).toBe(false);
  });

  it('refuses a form completed impossibly fast', () => {
    expect(verdict({ ...OK_SIGNALS, now: OK_SIGNALS.renderedAt + MIN_FILL_MS - 1 })).toEqual({
      allowed: false,
      reason: 'too_fast',
    });
  });

  it('treats a forged or future timestamp as too fast, not as a bypass', () => {
    /*
     * The timestamp is a hidden field, so it is attacker-controlled. Anything
     * unusable must fail CLOSED — an unparseable value that skipped the check
     * would make the whole signal opt-out.
     */
    expect(verdict({ ...OK_SIGNALS, renderedAt: Number.NaN }).allowed).toBe(false);
    expect(verdict({ ...OK_SIGNALS, renderedAt: OK_SIGNALS.now + 60_000 })).toEqual({
      allowed: false,
      reason: 'too_fast',
    });
  });

  it('refuses a stale page rather than accepting a replay', () => {
    expect(verdict({ ...OK_SIGNALS, now: OK_SIGNALS.renderedAt + MAX_FILL_MS + 1 })).toEqual({
      allowed: false,
      reason: 'stale',
    });
  });

  it('refuses a duplicate before it counts against the rate limit', () => {
    expect(verdict({ ...OK_SIGNALS, isDuplicate: true })).toEqual({
      allowed: false,
      reason: 'duplicate',
    });
  });

  it('rate limits at the configured ceiling', () => {
    expect(verdict({ ...OK_SIGNALS, recentSubmissions: RATE_LIMIT.max - 1 }).allowed).toBe(true);
    expect(verdict({ ...OK_SIGNALS, recentSubmissions: RATE_LIMIT.max })).toEqual({
      allowed: false,
      reason: 'rate_limited',
    });
  });
});

describe('payloads are bounded and validated', () => {
  const base = {
    name: 'Sam Trader',
    email: 'sam@example.com',
    subject: 'Import problem',
    message: 'x'.repeat(40),
    company: '',
    renderedAt: 1_000_000,
    consent: true as const,
  };

  it('accepts a well-formed contact request', () => {
    expect(contactRequestSchema.safeParse(base).success).toBe(true);
  });

  it.each([
    ['name', { name: 'a'.repeat(81) }],
    ['email', { email: 'not-an-email' }],
    ['subject', { subject: 'a'.repeat(141) }],
    ['message', { message: 'a'.repeat(4001) }],
  ])('rejects an oversized or malformed %s', (_f, over) => {
    expect(contactRequestSchema.safeParse({ ...base, ...over }).success).toBe(false);
  });

  it('requires explicit consent', () => {
    expect(contactRequestSchema.safeParse({ ...base, consent: false }).success).toBe(false);
  });

  it('normalises the email address', () => {
    const parsed = contactRequestSchema.parse({ ...base, email: '  SAM@Example.COM ' });
    expect(parsed.email).toBe('sam@example.com');
  });

  it('requires a known category on a support request', () => {
    expect(
      supportRequestSchema.safeParse({ ...base, category: 'billing_subscription' }).success,
    ).toBe(true);
    expect(supportRequestSchema.safeParse({ ...base, category: 'nonsense' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

describe('the transport never reports a send it did not make', () => {
  const ORIGINAL = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.RESEND_API_KEY;
    delete process.env.SUPPORT_FROM_EMAIL;
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
    vi.unstubAllGlobals();
  });

  it('reports not_configured when the key is absent, and calls nothing', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { sendEmail } = await import('@/server/email/resend-client');

    const result = await sendEmail({ to: 'a@b.com', subject: 's', text: 't' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('not_configured');
      // Names the missing variables so an operator can fix it.
      expect(result.detail).toContain('RESEND_API_KEY');
    }
    // The point: no provider call is attempted, so nothing can look like a send.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports the missing sender address too', async () => {
    process.env.RESEND_API_KEY = 're_test';
    const { missingEmailEnvKeys, isEmailConfigured } = await import('@/server/email/resend-client');
    expect(isEmailConfigured()).toBe(false);
    expect(missingEmailEnvKeys()).toEqual(['SUPPORT_FROM_EMAIL']);
  });

  it('returns the provider message id on success', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.SUPPORT_FROM_EMAIL = 'MetaTradee <support@metatradee.com>';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'msg_123' }) }),
    );
    const { sendEmail } = await import('@/server/email/resend-client');

    const result = await sendEmail({ to: 'a@b.com', subject: 's', text: 't' });
    expect(result).toEqual({ ok: true, id: 'msg_123' });
  });

  it('treats a 2xx with no id as a failure, not a success', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.SUPPORT_FROM_EMAIL = 'MetaTradee <support@metatradee.com>';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
    );
    const { sendEmail } = await import('@/server/email/resend-client');

    const result = await sendEmail({ to: 'a@b.com', subject: 's', text: 't' });
    expect(result.ok).toBe(false);
  });

  it.each([
    [422, 'rejected'],
    [401, 'rejected'],
    [500, 'transport_error'],
    [503, 'transport_error'],
  ])('maps HTTP %i to %s', async (status, reason) => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.SUPPORT_FROM_EMAIL = 'MetaTradee <support@metatradee.com>';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({ message: 'nope' }) }),
    );
    const { sendEmail } = await import('@/server/email/resend-client');

    const result = await sendEmail({ to: 'a@b.com', subject: 's', text: 't' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe(reason);
  });

  it('never leaks the api key or the provider body into the result', async () => {
    process.env.RESEND_API_KEY = 're_supersecret_key';
    process.env.SUPPORT_FROM_EMAIL = 'MetaTradee <support@metatradee.com>';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        // A provider error can echo submitted content back.
        json: async () => ({ message: 'invalid to: victim@example.com' }),
      }),
    );
    const { sendEmail } = await import('@/server/email/resend-client');

    const result = await sendEmail({ to: 'a@b.com', subject: 's', text: 't' });
    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain('re_supersecret_key');
    expect(serialised).not.toContain('victim@example.com');
  });
});

describe('the api key is server-only', () => {
  it('the transport module is marked server-only', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(
      resolve(__dirname, '../../../src/server/email/resend-client.ts'),
      'utf8',
    );
    expect(src).toContain("import 'server-only'");
    // The key is read from process.env and never re-exported.
    expect(src).not.toMatch(/NEXT_PUBLIC_[A-Z_]*RESEND/);
  });
});
