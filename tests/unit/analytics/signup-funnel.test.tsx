/**
 * The signup funnel, asserted against the real `RegisterForm`.
 *
 * THE TIMING IS THE WHOLE TEST. A funnel that counts a completed signup on a
 * button press, an optimistic update, or an "email already registered" response
 * reports growth that never happened — and someone will make a decision on it.
 * So the failure branches get as much attention here as the success one.
 *
 * `useSignUp` is mocked so each branch of the mutation can be driven
 * deliberately. Nothing else about the form is stubbed: the real Zod resolver,
 * the real fields and the real submit path all run, which is what makes
 * "started fires once" meaningful rather than a test of a mock.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * jsdom implements neither of these, and a Radix primitive in the form tree
 * uses them. Test-environment gaps, not product gaps.
 */
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

const mutate = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/register',
}));
vi.mock('@/features/auth/hooks/use-auth-mutations', () => ({
  useSignUp: () => ({ mutate, isPending: false }),
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
// The social buttons reach for browser auth APIs that jsdom has not got.
vi.mock('@/features/auth/components/social-auth', () => ({ SocialAuth: () => null }));

import { RegisterForm } from '@/features/auth/components/register-form';
import {
  resetAnalyticsSink,
  setAnalyticsSink,
  type AnalyticsSink,
} from '@/lib/analytics/analytics';

let sent: { name: string; props: Record<string, string | boolean> }[] = [];
const sink: AnalyticsSink = { track: (name, props) => sent.push({ name, props }) };

const namesOf = () => sent.map((e) => e.name);
const countOf = (name: string) => namesOf().filter((n) => n === name).length;

/** Drive the mocked mutation's success callback with a given server result. */
function respondWith(result: unknown) {
  mutate.mockImplementation((_values: unknown, opts: { onSuccess: (r: unknown) => void }) =>
    opts.onSuccess(result),
  );
}

beforeEach(() => {
  sent = [];
  mutate.mockReset();
  setAnalyticsSink(sink);
});
afterEach(() => {
  resetAnalyticsSink();
  vi.restoreAllMocks();
});

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/email/i), 'trader@example.com');
  await user.type(screen.getByLabelText(/^password$/i), 'Str0ngPassw0rd!');
  await user.type(screen.getByLabelText(/confirm password/i), 'Str0ngPassw0rd!');
  await user.click(screen.getByRole('checkbox'));
}

describe('signup_started', () => {
  it('does NOT fire merely because the form rendered', () => {
    render(<RegisterForm />);
    expect(namesOf()).not.toContain('signup_started');
  });

  it('fires on the first real interaction', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText(/email/i), 'a');
    expect(countOf('signup_started')).toBe(1);
    expect(sent[0]!.props).toEqual({ source_page: 'auth', source_component: 'register_form' });
  });

  it('fires exactly once no matter how much is typed', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText(/email/i), 'trader@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Str0ngPassw0rd!');
    await user.click(screen.getByRole('checkbox'));
    expect(countOf('signup_started')).toBe(1);
  });

  it('carries nothing the visitor typed', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText(/email/i), 'trader@example.com');
    const serialised = JSON.stringify(sent);
    expect(serialised).not.toContain('trader@example.com');
    expect(serialised).not.toContain('@');
  });
});

describe('signup_completed fires ONLY on confirmed success', () => {
  it('fires once when the server confirms the account', async () => {
    respondWith({ ok: true, redirectTo: '/verify-email' });
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(countOf('signup_completed')).toBe(1));
    expect(sent.at(-1)!.props).toEqual({ source_page: 'auth' });
  });

  it('does NOT fire when the server rejects the registration', async () => {
    respondWith({ ok: false, error: 'That email is already registered.' });
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(screen.getByText(/already registered/i)).toBeInTheDocument());
    expect(countOf('signup_completed')).toBe(0);
  });

  it('does NOT fire on field-level validation errors from the server', async () => {
    respondWith({ ok: false, error: 'Check the form.', fieldErrors: { email: 'Invalid.' } });
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(countOf('signup_completed')).toBe(0);
  });

  it('does NOT fire when the mutation throws', async () => {
    mutate.mockImplementation((_v: unknown, opts: { onError: () => void }) => opts.onError());
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(countOf('signup_completed')).toBe(0);
  });

  it('does NOT fire on the button press alone, before the server answers', async () => {
    // A mutation that never calls back: the click has happened, nothing is confirmed.
    mutate.mockImplementation(() => {});
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(countOf('signup_completed')).toBe(0);
  });

  it('does not submit at all when client validation fails', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(countOf('signup_started')).toBe(1));
    expect(mutate).not.toHaveBeenCalled();
    expect(countOf('signup_completed')).toBe(0);
  });
});

describe('analytics failure never blocks signup', () => {
  it('still completes registration when the sink throws', async () => {
    setAnalyticsSink({
      track: () => {
        throw new Error('beacon blocked');
      },
    });
    respondWith({ ok: true, redirectTo: '/verify-email' });
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    // The mutation ran and no error surfaced to the user.
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});
