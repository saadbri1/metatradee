import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocked Supabase server client + request headers. Declared via vi.hoisted so the
// mock factories (which are hoisted above imports) can close over them.
const { mockAuth, mockRpc, createClientMock } = vi.hoisted(() => {
  const mockAuth = {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
    updateUser: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    resend: vi.fn(),
  };
  const mockRpc = vi.fn();
  const createClientMock = vi.fn(async () => ({ auth: mockAuth, rpc: mockRpc }));
  return { mockAuth, mockRpc, createClientMock };
});

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({ get: () => null })),
}));

import {
  signInAction,
  signUpAction,
  signOutAction,
  requestPasswordResetAction,
  resetPasswordAction,
} from '@/features/auth/server/actions';

const VALID_PW = 'abcdef1234';

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc.mockResolvedValue({ data: null, error: null });
});

describe('signInAction', () => {
  it('signs in and audits success', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ error: null });
    const res = await signInAction({
      email: 'user@example.com',
      password: 'secret',
      rememberMe: true,
    });
    expect(res).toEqual({ ok: true, redirectTo: '/dashboard' });
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'secret',
    });
    expect(mockRpc).toHaveBeenCalledWith(
      'log_audit_event',
      expect.objectContaining({ p_event_type: 'auth.login.succeeded' }),
    );
  });

  it('honors a sanitized next target', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ error: null });
    const res = await signInAction({ email: 'user@example.com', password: 'secret' }, '/account');
    expect(res).toEqual({ ok: true, redirectTo: '/account' });
  });

  it('returns a generic error and audits failure on bad credentials', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });
    const res = await signInAction({
      email: 'user@example.com',
      password: 'wrong',
    });
    expect(res).toEqual({ ok: false, error: 'Invalid email or password.' });
    expect(mockRpc).toHaveBeenCalledWith(
      'log_audit_event',
      expect.objectContaining({ p_event_type: 'auth.login.failed' }),
    );
  });

  it('rejects invalid input before calling Supabase', async () => {
    const res = await signInAction({ email: 'nope', password: '' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors).toBeDefined();
    expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('signUpAction', () => {
  it('registers and routes to verification', async () => {
    mockAuth.signUp.mockResolvedValue({ error: null });
    const res = await signUpAction({
      email: 'user@example.com',
      password: VALID_PW,
      confirmPassword: VALID_PW,
      acceptTerms: true,
    });
    expect(res).toEqual({ ok: true, redirectTo: '/verify-email' });
    const arg = mockAuth.signUp.mock.calls[0]?.[0];
    expect(arg.email).toBe('user@example.com');
    expect(arg.options.emailRedirectTo).toContain('/auth/confirm');
  });

  it('rejects mismatched passwords with field errors', async () => {
    const res = await signUpAction({
      email: 'user@example.com',
      password: VALID_PW,
      confirmPassword: 'different99',
      acceptTerms: true,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors?.confirmPassword).toBeDefined();
    expect(mockAuth.signUp).not.toHaveBeenCalled();
  });
});

describe('requestPasswordResetAction', () => {
  it('always returns a neutral success (no enumeration)', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null });
    await expect(requestPasswordResetAction({ email: 'user@example.com' })).resolves.toEqual({
      ok: true,
    });

    // Even if Supabase errors internally, the response stays neutral.
    mockAuth.resetPasswordForEmail.mockResolvedValue({
      error: { message: 'boom' },
    });
    await expect(requestPasswordResetAction({ email: 'user@example.com' })).resolves.toEqual({
      ok: true,
    });
  });
});

describe('resetPasswordAction', () => {
  it('updates the password and revokes other sessions', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAuth.updateUser.mockResolvedValue({ error: null });
    mockAuth.signOut.mockResolvedValue({ error: null });

    const res = await resetPasswordAction({
      password: VALID_PW,
      confirmPassword: VALID_PW,
    });
    expect(res).toEqual({ ok: true, redirectTo: '/dashboard' });
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: VALID_PW });
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'others' });
  });

  it('fails when there is no recovery session', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await resetPasswordAction({
      password: VALID_PW,
      confirmPassword: VALID_PW,
    });
    expect(res.ok).toBe(false);
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });
});

describe('signOutAction', () => {
  it('signs out the current session and redirects to login', async () => {
    mockAuth.signOut.mockResolvedValue({ error: null });
    const res = await signOutAction();
    expect(res).toEqual({ ok: true, redirectTo: '/login' });
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
