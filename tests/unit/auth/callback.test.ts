/**
 * The OAuth callback and the email-confirmation handler.
 *
 * These two routes are where a session gets created, which makes them the most
 * security-sensitive code on the public surface. Three properties matter more
 * than the happy path:
 *
 *   NO OPEN REDIRECT. `next` has been through a third party, so it is
 *   untrusted on return regardless of what we sent out.
 *
 *   NO THIRD-PARTY TEXT IN OUR URLs. A provider's `error_description` is
 *   attacker-influencable and can carry the address that was attempted;
 *   forwarding it would render it on our page and log it.
 *
 *   THE RIGHT ANSWER TO A NON-FAILURE. Cancelling, and clicking an
 *   already-used link, are not errors and must not be reported as one.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const exchangeCodeForSession = vi.hoisted(() => vi.fn());
const verifyOtp = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession, verifyOtp, getUser } }),
}));
vi.mock('@/features/auth/server/audit', () => ({ logAuditEvent: vi.fn() }));

const clearPending = vi.hoisted(() => vi.fn());
vi.mock('@/features/auth/server/pending-email', () => ({
  clearPendingVerificationEmail: clearPending,
  setPendingVerificationEmail: vi.fn(),
  getPendingVerificationEmail: vi.fn(),
}));

const { GET: callback } = await import('@/app/auth/callback/route');
const { GET: confirm } = await import('@/app/auth/confirm/route');

const ORIGIN = 'https://www.metatradee.com';
const req = (path: string) =>
  new Request(`${ORIGIN}${path}`) as unknown as Parameters<typeof callback>[0];

const locationOf = (res: Response) => new URL(res.headers.get('location') as string);

beforeEach(() => {
  exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  verifyOtp.mockReset().mockResolvedValue({ error: null });
  getUser.mockReset().mockResolvedValue({ data: { user: null } });
  clearPending.mockReset();
});

describe('OAuth callback — success', () => {
  it('exchanges the code and lands on the requested destination', async () => {
    const res = await callback(req('/auth/callback?code=abc123&next=%2Fjournal'));
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc123');
    expect(locationOf(res).pathname).toBe('/journal');
  });

  it('falls back to the dashboard when no destination was given', async () => {
    const res = await callback(req('/auth/callback?code=abc123'));
    expect(locationOf(res).pathname).toBe('/dashboard');
  });

  it('creates no profile of its own', async () => {
    /*
     * Provisioning is `ensure_workspace_defaults`, an idempotent RPC the
     * (protected) layout runs. A second creation path here is exactly how
     * duplicate profiles appear, so the callback must only exchange the code.
     */
    await callback(req('/auth/callback?code=abc123'));
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });
});

describe('OAuth callback — refusals', () => {
  it.each([
    ['access_denied', 'oauth_cancelled'],
    ['user_cancelled_login', 'oauth_cancelled'],
    ['server_error', 'oauth_failed'],
    ['temporarily_unavailable', 'oauth_failed'],
  ])('maps provider error %s to %s', async (providerError, expected) => {
    const res = await callback(req(`/auth/callback?error=${providerError}`));
    const loc = locationOf(res);
    expect(loc.pathname).toBe('/login');
    expect(loc.searchParams.get('error')).toBe(expected);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('never forwards the provider description into our URL', async () => {
    const res = await callback(
      req(
        '/auth/callback?error=access_denied&error_description=' +
          encodeURIComponent('bob@example.com was refused'),
      ),
    );
    const location = res.headers.get('location') as string;
    expect(location).not.toContain('bob%40example.com');
    expect(location).not.toContain('bob@example.com');
    expect(location).not.toContain('refused');
  });

  it('fails cleanly when the exchange is rejected', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: 'bad code' } });
    const res = await callback(req('/auth/callback?code=nope'));
    expect(locationOf(res).searchParams.get('error')).toBe('oauth_failed');
  });

  it('survives a network fault during the exchange', async () => {
    exchangeCodeForSession.mockRejectedValue(new Error('ECONNRESET'));
    const res = await callback(req('/auth/callback?code=abc'));
    expect(locationOf(res).searchParams.get('error')).toBe('auth_callback_failed');
  });

  it('rejects a bare callback with neither code nor error', async () => {
    const res = await callback(req('/auth/callback'));
    expect(locationOf(res).searchParams.get('error')).toBe('auth_callback_failed');
  });
});

describe('OAuth callback — open redirect', () => {
  it.each([
    ['absolute external', 'https%3A%2F%2Fevil.example.com'],
    ['protocol-relative', '%2F%2Fevil.example.com'],
    ['scheme after slash', '%2Fjavascript%3Aalert(1)'],
    ['backslash', '%2F%5Cevil.example.com'],
  ])('refuses %s and lands internally', async (_label, hostile) => {
    const res = await callback(req(`/auth/callback?code=abc&next=${hostile}`));
    const loc = locationOf(res);
    expect(loc.origin).toBe(ORIGIN);
    expect(loc.pathname).toBe('/dashboard');
  });
});

describe('email confirmation', () => {
  it('verifies the token and lands on the destination', async () => {
    const res = await confirm(req('/auth/confirm?token_hash=tok&type=signup&next=%2Fdashboard'));
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'signup', token_hash: 'tok' });
    expect(locationOf(res).pathname).toBe('/dashboard');
  });

  it('clears the pending-email hint once the address is confirmed', async () => {
    await confirm(req('/auth/confirm?token_hash=tok&type=signup'));
    expect(clearPending).toHaveBeenCalledTimes(1);
  });

  it('tells an EXPIRED link apart from an invalid one', async () => {
    // The common case by far: links are short-lived, people read mail later.
    verifyOtp.mockResolvedValue({ error: { message: 'Email link is invalid or has expired' } });
    const res = await confirm(req('/auth/confirm?token_hash=old&type=signup'));
    const loc = locationOf(res);
    expect(loc.pathname).toBe('/verify-email');
    expect(loc.searchParams.get('error')).toBe('verification_expired');
  });

  it('reports a genuinely invalid token as invalid', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'Token not found' } });
    const res = await confirm(req('/auth/confirm?token_hash=forged&type=signup'));
    expect(locationOf(res).searchParams.get('error')).toBe('verification_failed');
  });

  it('sends an ALREADY-VERIFIED visitor onward instead of showing an error', async () => {
    /*
     * A double tap, a prefetching mail client or a forwarded message lands here
     * with a spent token. If they are already verified, the link did its job.
     */
    verifyOtp.mockResolvedValue({ error: { message: 'Token has already been used' } });
    getUser.mockResolvedValue({
      data: { user: { email_confirmed_at: '2026-08-09T00:00:00Z' } },
    });
    const res = await confirm(req('/auth/confirm?token_hash=used&type=signup&next=%2Fjournal'));
    const loc = locationOf(res);
    expect(loc.pathname).toBe('/journal');
    expect(loc.searchParams.get('error')).toBeNull();
  });

  it('refuses a missing token', async () => {
    const res = await confirm(req('/auth/confirm'));
    expect(locationOf(res).searchParams.get('error')).toBe('verification_failed');
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('maps a Supabase otp_expired bounce to the expired message', async () => {
    const res = await confirm(req('/auth/confirm?error=access_denied&error_code=otp_expired'));
    expect(locationOf(res).searchParams.get('error')).toBe('verification_expired');
  });

  it('never becomes an open redirect', async () => {
    const res = await confirm(
      req('/auth/confirm?token_hash=tok&type=signup&next=https%3A%2F%2Fevil.example.com'),
    );
    const loc = locationOf(res);
    expect(loc.origin).toBe(ORIGIN);
    expect(loc.pathname).toBe('/dashboard');
  });
});
