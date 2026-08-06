/**
 * The chatbot interface.
 *
 * THE HEADLINE ASSERTION is the right-to-left one: choosing Arabic must set
 * `dir="rtl"` on the PANEL and leave `<html>` untouched. That is the whole
 * brief — a multilingual widget on an English site — and it is the single
 * easiest thing to get wrong, because the obvious implementation is a global
 * `dir` toggle that silently mirrors every marketing page behind the panel.
 *
 * The rest covers the behaviour a support widget is judged on: it opens, it
 * answers, it keeps the privacy warning in front of the composer, it recovers
 * from a failed send, and the route to a human is always reachable.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const submitChatEscalationAction = vi.hoisted(() => vi.fn());
vi.mock('@/features/support-chat/server/actions', () => ({ submitChatEscalationAction }));

import { SupportChat } from '@/features/support-chat/components/support-chat';
import { dictionaryFor } from '@/features/support-chat/translations';

const en = dictionaryFor('en');
const fr = dictionaryFor('fr');
const ar = dictionaryFor('ar');

/** A reply from the chat endpoint, in the shape the client expects. */
function replyWith(reply: string, extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      reply,
      source: 'knowledge',
      topicId: 'what_is',
      suggestEscalation: false,
      href: null,
      ...extra,
    }),
  } as Response;
}

beforeEach(() => {
  window.localStorage.clear();
  submitChatEscalationAction.mockReset();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(replyWith('An approved answer.')));
  // jsdom does not implement these; the panel scrolls and checks reduced motion.
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    'matchMedia',
    vi
      .fn()
      .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  // `unstubAllGlobals` does not undo a spy: without this, the offline test's
  // `navigator.onLine` override leaks into every test that runs after it.
  vi.restoreAllMocks();
});

async function open() {
  const user = userEvent.setup();
  render(<SupportChat />);
  await user.click(screen.getByRole('button', { name: en.launcher.label }));
  return user;
}

describe('the launcher', () => {
  it('starts closed and reports its state', () => {
    render(<SupportChat />);
    const launcher = screen.getByRole('button', { name: en.launcher.label });
    expect(launcher).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps one stable accessible name instead of colliding with the close button', async () => {
    /*
     * The launcher used to rename itself to "Close the MetaTradee Assistant"
     * while open, which is byte-identical to the panel's own close button.
     * Two controls, one name, no way to tell them apart by voice — and
     * Playwright's strict mode caught it before a user had to.
     */
    const user = await open();
    const launcher = screen.getByRole('button', { name: en.launcher.label });
    expect(launcher).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('button', { name: en.launcher.close })).toHaveLength(1);
    await user.click(launcher);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the panel and greets the visitor', async () => {
    await open();
    expect(screen.getByRole('dialog', { name: en.assistantName })).toBeInTheDocument();
    expect(screen.getByText(en.welcome)).toBeInTheDocument();
  });

  it('says plainly that it is not a person', async () => {
    await open();
    expect(screen.getByText(en.disclosure)).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the launcher', async () => {
    const user = await open();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: en.launcher.label })).toHaveFocus();
  });
});

describe('right-to-left is scoped to the chatbot', () => {
  it('flips the panel and nothing else when Arabic is chosen', async () => {
    const user = await open();
    const before = document.documentElement.getAttribute('dir');

    await user.selectOptions(screen.getByLabelText(en.languageSelector.label), 'ar');

    const panel = screen.getByRole('dialog', { name: ar.assistantName });
    expect(panel).toHaveAttribute('dir', 'rtl');
    expect(panel).toHaveAttribute('lang', 'ar');

    // The document is untouched: the site around the widget stays as it was.
    expect(document.documentElement.getAttribute('dir')).toBe(before);
    expect(document.documentElement.getAttribute('lang')).not.toBe('ar');
  });

  it('leaves the panel left-to-right for English and French', async () => {
    const user = await open();
    expect(screen.getByRole('dialog')).toHaveAttribute('dir', 'ltr');
    await user.selectOptions(screen.getByLabelText(en.languageSelector.label), 'fr');
    expect(screen.getByRole('dialog')).toHaveAttribute('dir', 'ltr');
  });
});

describe('language selection', () => {
  it('translates the whole interface', async () => {
    const user = await open();
    await user.selectOptions(screen.getByLabelText(en.languageSelector.label), 'fr');

    expect(screen.getByText(fr.welcome)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(fr.inputPlaceholder)).toBeInTheDocument();
    expect(screen.getByText(fr.privacyWarning)).toBeInTheDocument();
    expect(screen.queryByText(en.welcome)).not.toBeInTheDocument();
  });

  it('remembers the choice for the next visit', async () => {
    const user = await open();
    await user.selectOptions(screen.getByLabelText(en.languageSelector.label), 'ar');
    await waitFor(() =>
      expect(window.localStorage.getItem('metatradee.support-chat.locale')).toBe('ar'),
    );
  });

  it('offers every language under its own name', async () => {
    await open();
    const select = screen.getByLabelText(en.languageSelector.label);
    for (const label of ['English', 'Français', 'العربية']) {
      expect(within(select).getByText(label)).toBeInTheDocument();
    }
  });
});

describe('the conversation', () => {
  it('sends a typed message and shows the reply', async () => {
    const user = await open();
    await user.type(screen.getByLabelText(en.inputLabel), 'What is MetaTradee?');
    await user.click(screen.getByRole('button', { name: en.send }));

    expect(await screen.findByText('An approved answer.')).toBeInTheDocument();
    expect(screen.getByText('What is MetaTradee?')).toBeInTheDocument();
  });

  it('sends on Enter and keeps Shift+Enter for a new line', async () => {
    const user = await open();
    const field = screen.getByLabelText(en.inputLabel);
    await user.type(field, 'first{Shift>}{Enter}{/Shift}second');
    expect(fetch).not.toHaveBeenCalled();
    await user.type(field, '{Enter}');
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it('carries the chosen language to the server', async () => {
    const user = await open();
    await user.selectOptions(screen.getByLabelText(en.languageSelector.label), 'ar');
    await user.type(screen.getByLabelText(ar.inputLabel), 'ما هو MetaTradee؟');
    await user.click(screen.getByRole('button', { name: ar.send }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0]?.[1]?.body as string) ?? '{}');
    expect(body.locale).toBe('ar');
  });

  it('starts with quick actions and drops them once the thread begins', async () => {
    const user = await open();
    const quick = screen.getByRole('button', { name: en.quickActions[0]?.label });
    await user.click(quick);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: en.quickActions[0]?.label }),
      ).not.toBeInTheDocument(),
    );
  });

  it('announces the transcript as a live log', async () => {
    await open();
    const log = screen.getByRole('log', { name: en.messages.log });
    expect(log).toHaveAttribute('aria-live', 'polite');
  });
});

describe('failure states', () => {
  it('reports a failed send and offers a retry that resends the same turn', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    const user = await open();
    await user.type(screen.getByLabelText(en.inputLabel), 'What is MetaTradee?');
    await user.click(screen.getByRole('button', { name: en.send }));

    expect(await screen.findByText(en.error)).toBeInTheDocument();

    vi.mocked(fetch).mockResolvedValueOnce(replyWith('Recovered answer.'));
    await user.click(screen.getByRole('button', { name: en.retry }));
    expect(await screen.findByText('Recovered answer.')).toBeInTheDocument();
  });

  it('does not attempt a send while the browser reports it is offline', async () => {
    const user = await open();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    await user.type(screen.getByLabelText(en.inputLabel), 'Anything at all');
    await user.click(screen.getByRole('button', { name: en.send }));

    expect(await screen.findByText(en.offline)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('the privacy warning', () => {
  it('is always visible under the composer', async () => {
    await open();
    expect(screen.getByText(en.privacyWarning)).toBeInTheDocument();
    expect(screen.getByLabelText(en.inputLabel)).toHaveAttribute(
      'aria-describedby',
      'support-chat-privacy',
    );
  });

  it('escalates when what has been typed looks like a credential', async () => {
    const user = await open();
    await user.type(screen.getByLabelText(en.inputLabel), 'sk-live-ABCDEFGHIJKLMNOPQRST');
    await waitFor(() =>
      expect(screen.getByText(en.privacyWarning)).toHaveClass('text-destructive'),
    );
  });
});

describe('escalation to a person', () => {
  it('is reachable at any time, without having to ask for it', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: en.escalation.open }));
    expect(screen.getByText(en.escalation.title)).toBeInTheDocument();
    expect(screen.getByLabelText(en.form.email)).toBeInTheDocument();
  });

  it('validates in the chosen language before anything is submitted', async () => {
    const user = await open();
    await user.selectOptions(screen.getByLabelText(en.languageSelector.label), 'fr');
    await user.click(screen.getByRole('button', { name: fr.escalation.open }));
    await user.click(screen.getByRole('button', { name: fr.escalation.submit }));

    expect(await screen.findByText(fr.validation.name)).toBeInTheDocument();
    expect(screen.getByText(fr.validation.email)).toBeInTheDocument();
    expect(submitChatEscalationAction).not.toHaveBeenCalled();
  });

  it('shows the real support address when sending is unavailable', async () => {
    // The state this ships in: Resend is not configured.
    submitChatEscalationAction.mockResolvedValue({
      ok: false,
      message: en.escalation.failure,
      showFallback: true,
    });

    const user = await open();
    await user.click(screen.getByRole('button', { name: en.escalation.open }));
    await user.type(screen.getByLabelText(en.form.name), 'Sam');
    await user.type(screen.getByLabelText(en.form.email), 'sam@example.com');
    await user.type(screen.getByLabelText(en.form.subject), 'Import failing');
    await user.type(
      screen.getByLabelText(en.form.message),
      'The MetaTrader 5 import fails every time with no error message shown.',
    );
    await user.click(screen.getByLabelText(en.form.consent));
    await user.click(screen.getByRole('button', { name: en.escalation.submit }));

    expect(await screen.findByText(en.escalation.failure)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'support@metatradee.com' });
    expect(link).toHaveAttribute('href', 'mailto:support@metatradee.com');
  });

  it('reports success only when the server confirms it', async () => {
    submitChatEscalationAction.mockResolvedValue({ ok: true, message: en.escalation.success });

    const user = await open();
    await user.click(screen.getByRole('button', { name: en.escalation.open }));
    await user.type(screen.getByLabelText(en.form.name), 'Sam');
    await user.type(screen.getByLabelText(en.form.email), 'sam@example.com');
    await user.type(screen.getByLabelText(en.form.subject), 'Import failing');
    await user.type(
      screen.getByLabelText(en.form.message),
      'The MetaTrader 5 import fails every time with no error message shown.',
    );
    await user.click(screen.getByLabelText(en.form.consent));
    await user.click(screen.getByRole('button', { name: en.escalation.submit }));

    expect(await screen.findByText(en.escalation.success)).toBeInTheDocument();
  });

  it('carries the conversation into the submission', async () => {
    submitChatEscalationAction.mockResolvedValue({ ok: true, message: en.escalation.success });

    const user = await open();
    await user.type(screen.getByLabelText(en.inputLabel), 'What is MetaTradee?');
    await user.click(screen.getByRole('button', { name: en.send }));
    await screen.findByText('An approved answer.');

    await user.click(screen.getByRole('button', { name: en.escalation.open }));
    await user.type(screen.getByLabelText(en.form.name), 'Sam');
    await user.type(screen.getByLabelText(en.form.email), 'sam@example.com');
    await user.type(screen.getByLabelText(en.form.subject), 'Still stuck');
    await user.type(
      screen.getByLabelText(en.form.message),
      'I asked the assistant already and still need a person to look at this.',
    );
    await user.click(screen.getByLabelText(en.form.consent));
    await user.click(screen.getByRole('button', { name: en.escalation.submit }));

    await waitFor(() => expect(submitChatEscalationAction).toHaveBeenCalled());
    const payload = submitChatEscalationAction.mock.calls[0]?.[0] as {
      message: string;
      company: string;
      renderedAt: number;
      locale: string;
    };
    expect(payload.message).toContain('What is MetaTradee?');
    expect(payload.locale).toBe('en');
    // The Phase 2 bot-protection fields travel with it, or the shared guard
    // would refuse the very submission it is meant to protect.
    expect(payload.company).toBe('');
    expect(payload.renderedAt).toBeGreaterThan(0);
  });
});
