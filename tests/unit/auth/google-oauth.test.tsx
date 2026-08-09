/**
 * Google sign-in: the button, the flow it starts, and what it must never send.
 *
 * THE FLOW IS THE RISKY PART, not the pixels. A social sign-in button that
 * looks right but starts the flow with an unsanitised redirect is an open
 * redirect on the most security-sensitive page in the product; one that leaks
 * a code or a token into analytics is a session-theft vector. Those get the
 * attention here.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signInWithOAuth = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithOAuth } }),
}));

/** Google enabled, as it will be once the dashboard is configured. */
vi.mock('@/features/auth/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/auth/config')>();
  return {
    ...actual,
    OAUTH_PROVIDERS: [
      { id: 'google', label: 'Google', enabled: true },
      { id: 'github', label: 'GitHub', enabled: false },
      { id: 'apple', label: 'Apple', enabled: false },
      { id: 'microsoft', label: 'Microsoft', enabled: false },
    ],
  };
});

import { SocialAuth } from '@/features/auth/components/social-auth';
import {
  resetAnalyticsSink,
  setAnalyticsSink,
  type AnalyticsSink,
} from '@/lib/analytics/analytics';

let sent: { name: string; props: Record<string, string | boolean> }[] = [];
const sink: AnalyticsSink = { track: (name, props) => sent.push({ name, props }) };

beforeEach(() => {
  sent = [];
  setAnalyticsSink(sink);
  signInWithOAuth.mockReset();
  signInWithOAuth.mockResolvedValue({ error: null });
});
afterEach(() => {
  resetAnalyticsSink();
  vi.restoreAllMocks();
});

const button = () => screen.getByRole('button', { name: /continue with google/i });

describe('the button', () => {
  it('renders with an accessible name', () => {
    render(<SocialAuth />);
    expect(button()).toBeInTheDocument();
  });

  it('is reachable and operable by keyboard', async () => {
    const user = userEvent.setup();
    render(<SocialAuth />);
    await user.tab();
    expect(button()).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1));
  });

  it('shows a divider so the two sign-in paths read as alternatives', () => {
    render(<SocialAuth />);
    expect(screen.getByText('or')).toBeInTheDocument();
  });

  it('renders nothing at all when no provider is enabled', async () => {
    vi.resetModules();
    vi.doMock('@/features/auth/config', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/features/auth/config')>();
      return { ...actual, OAUTH_PROVIDERS: [{ id: 'google', label: 'Google', enabled: false }] };
    });
    const { SocialAuth: Disabled } = await import('@/features/auth/components/social-auth');
    const { container } = render(<Disabled />);
    // No orphan divider either — a lone "or" above a form is nonsense.
    expect(container).toBeEmptyDOMElement();
    vi.doUnmock('@/features/auth/config');
  });
});

describe('starting the flow', () => {
  it('calls Supabase with the google provider and our callback', async () => {
    const user = userEvent.setup();
    render(<SocialAuth next="/journal" />);
    await user.click(button());

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1));
    const arg = signInWithOAuth.mock.calls[0]![0] as {
      provider: string;
      options: { redirectTo: string };
    };
    expect(arg.provider).toBe('google');

    const redirect = new URL(arg.options.redirectTo);
    expect(redirect.pathname).toBe('/auth/callback');
    expect(redirect.searchParams.get('next')).toBe('/journal');
  });

  it('SANITISES the destination before it leaves the browser', async () => {
    const user = userEvent.setup();
    // An open-redirect attempt arriving via ?next= on the sign-in page.
    render(<SocialAuth next="https://evil.example.com/steal" />);
    await user.click(button());

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalled());
    const arg = signInWithOAuth.mock.calls[0]![0] as { options: { redirectTo: string } };
    const next = new URL(arg.options.redirectTo).searchParams.get('next');
    expect(next).toBe('/dashboard');
    expect(arg.options.redirectTo).not.toContain('evil.example.com');
  });

  it.each([
    ['protocol-relative', '//evil.example.com'],
    ['a scheme after the slash', '/javascript:alert(1)'],
    ['a backslash escape', '/\\evil.example.com'],
  ])('refuses %s as a destination', async (_label, hostile) => {
    const user = userEvent.setup();
    render(<SocialAuth next={hostile} />);
    await user.click(button());
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalled());
    const arg = signInWithOAuth.mock.calls[0]![0] as { options: { redirectTo: string } };
    expect(new URL(arg.options.redirectTo).searchParams.get('next')).toBe('/dashboard');
  });
});

describe('double submission', () => {
  it('starts the flow once however many times the button is pressed', async () => {
    // A second press abandons the first flow's PKCE verifier; the callback
    // would then have nothing to exchange the code against.
    signInWithOAuth.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    render(<SocialAuth />);
    /*
     * Held by reference, not re-queried: after the first press the label
     * becomes "Connecting to Google…", so looking it up again by its idle name
     * would fail for the wrong reason. The point is that the same control,
     * pressed repeatedly, starts one flow.
     */
    const el = button();
    await user.click(el);
    await user.click(el);
    await user.click(el);
    expect(signInWithOAuth).toHaveBeenCalledTimes(1);
  });

  it('disables the button and announces the busy state', async () => {
    signInWithOAuth.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    render(<SocialAuth />);
    await user.click(button());
    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled());
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });
});

describe('failures are explained without echoing the provider', () => {
  it('shows our own message when Supabase refuses', async () => {
    signInWithOAuth.mockResolvedValue({
      error: { message: 'Provider said: user bob@example.com is banned' },
    });
    const user = userEvent.setup();
    render(<SocialAuth />);
    await user.click(button());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not start google sign-in/i);
    // The provider's text can carry the attempted address. It must not surface.
    expect(alert).not.toHaveTextContent('bob@example.com');
  });

  it('recovers from a network failure and re-enables the button', async () => {
    signInWithOAuth.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    render(<SocialAuth />);
    await user.click(button());

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach google/i);
    await waitFor(() => expect(button()).not.toBeDisabled());
  });
});

describe('analytics never sees anything from this flow', () => {
  it('emits no event at all when OAuth starts', async () => {
    const user = userEvent.setup();
    render(<SocialAuth next="/dashboard" />);
    await user.click(button());
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalled());
    // Nothing here is safe to report: the flow carries a code and, later, a
    // session. It is deliberately uninstrumented.
    expect(sent).toEqual([]);
  });

  it('emits nothing on failure either', async () => {
    signInWithOAuth.mockResolvedValue({ error: { message: 'nope' } });
    const user = userEvent.setup();
    render(<SocialAuth />);
    await user.click(button());
    await screen.findByRole('alert');
    expect(sent).toEqual([]);
  });
});
