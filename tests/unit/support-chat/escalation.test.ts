/**
 * Escalation — the transcript builder and the server action.
 *
 * THE ONE THING THAT MUST NEVER HAPPEN is a "sent" message when nothing was
 * sent. Resend is still unconfigured, so the real behaviour today is a typed
 * failure plus the direct address, and the tests below assert that the chatbot
 * inherits that honesty from Phase 2 rather than papering over it with its own
 * optimistic copy.
 *
 * The action is tested against a MOCKED Phase 2 action on purpose: what is
 * being verified here is the delegation and the translation, not the email
 * transport — that already has its own tests.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildEscalationMessage, MAX_MESSAGE_LENGTH } from '@/features/support-chat/transcript';
import { dictionaryFor } from '@/features/support-chat/translations';
import type { ChatMessage } from '@/features/support-chat/types';

const submitSupportRequestAction = vi.hoisted(() => vi.fn());
vi.mock('@/features/contact/server/actions', () => ({ submitSupportRequestAction }));

import { submitChatEscalationAction } from '@/features/support-chat/server/actions';

function turn(role: 'user' | 'assistant', content: string, index: number): ChatMessage {
  return { id: `t${index}`, role, content, at: 1_000 + index, locale: 'en' };
}

const CONVERSATION: ChatMessage[] = [
  turn('user', 'My import failed', 0),
  turn('assistant', 'Which platform was the file from?', 1),
  turn('user', 'MetaTrader 5, exported yesterday', 2),
];

describe('the transcript', () => {
  it('attaches the conversation under a translated heading', () => {
    const body = buildEscalationMessage({
      description: 'The import still fails.',
      messages: CONVERSATION,
      locale: 'fr',
      includeTranscript: true,
    });
    expect(body).toContain('The import still fails.');
    expect(body).toContain(dictionaryFor('fr').escalation.transcriptHeading);
    expect(body).toContain('MetaTrader 5, exported yesterday');
  });

  it('omits the conversation when the visitor unticks it', () => {
    const body = buildEscalationMessage({
      description: 'Just this, thanks.',
      messages: CONVERSATION,
      locale: 'en',
      includeTranscript: false,
    });
    expect(body).toBe('Just this, thanks.');
  });

  it('redacts a credential that was pasted into the chat', () => {
    const body = buildEscalationMessage({
      description: 'Here is what happened.',
      messages: [turn('user', 'my password is Hunter2Hunter2', 0)],
      locale: 'en',
      includeTranscript: true,
    });
    expect(body).not.toContain('Hunter2Hunter2');
    expect(body).toContain('[password removed]');
  });

  it('redacts a credential typed into the description itself', () => {
    const body = buildEscalationMessage({
      description: 'my api key is ABCD1234EFGH5678 and it stopped working',
      messages: [],
      locale: 'en',
      includeTranscript: true,
    });
    expect(body).not.toContain('ABCD1234EFGH5678');
  });

  it('stays inside the schema length cap and drops the OLDEST turns', () => {
    const long = Array.from({ length: 200 }, (_, i) =>
      turn(i % 2 === 0 ? 'user' : 'assistant', `message number ${i} ${'x'.repeat(60)}`, i),
    );
    const body = buildEscalationMessage({
      description: 'Escalating this.',
      messages: long,
      locale: 'en',
      includeTranscript: true,
    });

    expect(body.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
    // The newest turn survives; the oldest does not.
    expect(body).toContain('message number 199');
    expect(body).not.toContain('message number 0 ');
    // And the reader is told, rather than being handed a silent truncation.
    expect(body).toContain('omitted');
  });

  it('keeps the description whole even when there is no room for history', () => {
    const description = 'y'.repeat(MAX_MESSAGE_LENGTH - 10);
    const body = buildEscalationMessage({
      description,
      messages: CONVERSATION,
      locale: 'en',
      includeTranscript: true,
    });
    expect(body).toBe(description);
  });
});

describe('the escalation action', () => {
  const PAYLOAD = {
    name: 'Sam',
    email: 'sam@example.com',
    subject: 'Import failing',
    category: 'trade_import' as const,
    message: 'The MT5 import fails every time I try it, with no error shown.',
    consent: true,
    company: '',
    renderedAt: 1_000,
  };

  beforeEach(() => {
    submitSupportRequestAction.mockReset();
  });

  it('delegates to the Phase 2 support action rather than sending its own mail', async () => {
    submitSupportRequestAction.mockResolvedValue({ ok: true, message: 'Thanks — on its way.' });
    await submitChatEscalationAction({ ...PAYLOAD, locale: 'fr' });
    expect(submitSupportRequestAction).toHaveBeenCalledTimes(1);
  });

  it('never forwards the chatbot locale into the support payload', async () => {
    submitSupportRequestAction.mockResolvedValue({ ok: true, message: 'ok' });
    await submitChatEscalationAction({ ...PAYLOAD, locale: 'ar' });
    expect(submitSupportRequestAction.mock.calls[0]?.[0]).not.toHaveProperty('locale');
  });

  it('redacts the message again on the server', async () => {
    submitSupportRequestAction.mockResolvedValue({ ok: true, message: 'ok' });
    await submitChatEscalationAction({
      ...PAYLOAD,
      locale: 'en',
      message: 'my password is Hunter2Hunter2 and the import still fails',
    });
    const forwarded = submitSupportRequestAction.mock.calls[0]?.[0] as { message: string };
    expect(forwarded.message).not.toContain('Hunter2Hunter2');
  });

  it('translates the success message', async () => {
    submitSupportRequestAction.mockResolvedValue({ ok: true, message: 'English success' });
    const result = await submitChatEscalationAction({ ...PAYLOAD, locale: 'fr' });
    expect(result.ok).toBe(true);
    expect(result.message).toBe(dictionaryFor('fr').escalation.success);
  });

  it('preserves the honest failure and offers the real address', async () => {
    // What actually happens today: the transport is not configured.
    submitSupportRequestAction.mockResolvedValue({
      ok: false,
      code: 'send_failed',
      message: 'We could not send that message just now.',
      showFallback: true,
    });
    const result = await submitChatEscalationAction({ ...PAYLOAD, locale: 'ar' });
    expect(result.ok).toBe(false);
    expect(result.showFallback).toBe(true);
    expect(result.message).toBe(dictionaryFor('ar').escalation.failure);
  });

  it('gives a bot no diagnostic, and the visitor a way out', async () => {
    submitSupportRequestAction.mockResolvedValue({
      ok: false,
      code: 'blocked',
      message: 'We could not send that. Please try again.',
    });
    const result = await submitChatEscalationAction({ ...PAYLOAD, locale: 'en' });
    expect(result.ok).toBe(false);
    expect(result.showFallback).toBe(true);
    // No mention of which guard tripped.
    expect(result.message).toBe(dictionaryFor('en').escalation.failure);
  });

  it('translates field errors by key rather than showing English prose', async () => {
    submitSupportRequestAction.mockResolvedValue({
      ok: false,
      code: 'validation',
      message: 'Please check the highlighted fields.',
      fieldErrors: { email: 'Please check this email address.' },
    });
    const result = await submitChatEscalationAction({ ...PAYLOAD, locale: 'fr' });
    expect(result.message).toBe(dictionaryFor('fr').validation.generic);
    expect(result.fieldErrors?.email).toBe(dictionaryFor('fr').validation.email);
  });

  it('falls back to English for an unrecognised locale instead of throwing', async () => {
    submitSupportRequestAction.mockResolvedValue({ ok: true, message: 'ok' });
    const result = await submitChatEscalationAction({ ...PAYLOAD, locale: 'klingon' });
    expect(result.message).toBe(dictionaryFor('en').escalation.success);
  });
});
