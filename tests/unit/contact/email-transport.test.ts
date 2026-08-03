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
import {
  INQUIRY_TYPES,
  contactRequestSchema,
  supportRequestSchema,
} from '@/features/contact/schemas';

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
    inquiryType: 'general' as const,
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

  it('rejects an unknown inquiry type', () => {
    expect(contactRequestSchema.safeParse({ ...base, inquiryType: 'nonsense' }).success).toBe(
      false,
    );
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

describe('the recipient is decided on the server, never by the client', () => {
  it('maps every inquiry type to its own mailbox', async () => {
    const { recipientFor } = await import('@/server/email/send-contact-request');
    const { COMPANY_EMAILS } = await import('@/config/contact');
    expect(recipientFor('general')).toBe(COMPANY_EMAILS.contact);
    expect(recipientFor('information')).toBe(COMPANY_EMAILS.info);
    expect(recipientFor('sales')).toBe(COMPANY_EMAILS.sales);
    expect(recipientFor('support')).toBe(COMPANY_EMAILS.support);
  });

  it('covers every inquiry type, so none can fall through to undefined', async () => {
    const { recipientFor } = await import('@/server/email/send-contact-request');
    for (const t of INQUIRY_TYPES) {
      expect(recipientFor(t), `no mailbox for ${t}`).toMatch(/@metatradee\.com$/);
    }
  });

  it('actually SENDS to the mapped mailbox, not just exposes a map', async () => {
    /*
     * The gap that let a real bug through: recipientFor() was correct and
     * tested, but sendContactRequest still hardcoded one address and never
     * called it. Testing the map alone proved nothing about the sender.
     */
    process.env.RESEND_API_KEY = 're_test';
    process.env.SUPPORT_FROM_EMAIL = 'MetaTradee <support@example.com>';
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'm' }) });
    vi.stubGlobal('fetch', fetchSpy);

    const { sendContactRequest } = await import('@/server/email/send-contact-request');
    const { COMPANY_EMAILS } = await import('@/config/contact');

    const cases: [string, string][] = [
      ['general', COMPANY_EMAILS.contact],
      ['information', COMPANY_EMAILS.info],
      ['sales', COMPANY_EMAILS.sales],
      ['support', COMPANY_EMAILS.support],
    ];
    for (const [type, expected] of cases) {
      fetchSpy.mockClear();
      await sendContactRequest({
        name: 'A',
        email: 'a@b.com',
        inquiryType: type as never,
        subject: 'Hello there',
        message: 'x'.repeat(40),
      });
      const body = JSON.parse((fetchSpy.mock.calls[0]?.[1] as { body: string }).body);
      expect(body.to, `${type} routed wrong`).toEqual([expected]);
    }
  });

  it('never lets the submitted address become the From header', async () => {
    // From must always be our verified sender; the submitter is Reply-To only.
    process.env.RESEND_API_KEY = 're_test';
    process.env.SUPPORT_FROM_EMAIL = 'MetaTradee <support@example.com>';
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'm' }) });
    vi.stubGlobal('fetch', fetchSpy);
    const { sendContactRequest } = await import('@/server/email/send-contact-request');

    await sendContactRequest({
      name: 'A',
      email: 'spoofed@evil.example',
      inquiryType: 'general',
      subject: 'Hi there',
      message: 'x'.repeat(40),
    });
    const body = JSON.parse((fetchSpy.mock.calls[0]?.[1] as { body: string }).body);
    expect(body.from).toBe('MetaTradee <support@example.com>');
    expect(body.reply_to).toBe('spoofed@evil.example');
  });

  it('strips CR/LF from the subject so no header can be injected', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.SUPPORT_FROM_EMAIL = 'MetaTradee <support@example.com>';
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'm' }) });
    vi.stubGlobal('fetch', fetchSpy);
    const { sendContactRequest } = await import('@/server/email/send-contact-request');

    await sendContactRequest({
      name: 'A',
      email: 'a@b.com',
      inquiryType: 'general',
      subject: 'Hello\r\nBcc: victim@example.com',
      message: 'x'.repeat(40),
    });
    const body = JSON.parse((fetchSpy.mock.calls[0]?.[1] as { body: string }).body);
    /*
     * The property that matters is that NO NEWLINE survives. With CR/LF gone,
     * "Bcc:" is inert text on the subject line and cannot become a header —
     * asserting the substring is absent would be testing the wrong thing, and
     * would fail on a subject that legitimately mentions it.
     */
    expect(body.subject).not.toMatch(/[\r\n]/);
    expect(body.subject).toBe('[General inquiry] Hello Bcc: victim@example.com');
  });

  it('accepts no recipient field from the client', async () => {
    /*
     * The schema has no `to`. A form that accepted one would let anyone who can
     * post to the action send mail from our verified domain to any address.
     */
    const parsed = contactRequestSchema.safeParse({
      name: 'A',
      email: 'a@b.com',
      inquiryType: 'general',
      subject: 'Hello there',
      message: 'x'.repeat(40),
      company: '',
      renderedAt: 1,
      consent: true,
      to: 'attacker@evil.example',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect('to' in parsed.data).toBe(false);
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
