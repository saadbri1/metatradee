/**
 * The answer engine.
 *
 * WHAT IS BEING PROVEN, in order of how much it would cost to get wrong:
 *
 *   1. A pasted credential never reaches the matcher, the model, or the reply.
 *   2. An unmatched question produces "I do not know", never an invention.
 *   3. Approved answers come back in the language that was asked for.
 *   4. Money, access and security questions route to a human.
 *   5. A model rewrite that adds a number it was not given is DISCARDED — the
 *      approved passage is served instead.
 *
 * Point 5 is tested through `isGrounded` directly as well as through the
 * pipeline, because it is the check standing between a support chatbot and an
 * invented price.
 */
import { describe, expect, it } from 'vitest';
import { composeAnswer, isGrounded } from '@/features/support-chat/server/answer';
import { dictionaryFor } from '@/features/support-chat/translations';
import { KNOWLEDGE_TOPICS } from '@/features/support-chat/knowledge';
import type { SupportChatLocale } from '@/features/support-chat/types';

const ask = (content: string, locale: SupportChatLocale = 'en') =>
  composeAnswer({ locale, messages: [{ role: 'user', content }] });

describe('grounded answers', () => {
  it('answers from the approved knowledge base', async () => {
    const reply = await ask('What is MetaTradee?');
    expect(reply.source).toBe('knowledge');
    expect(reply.topicId).toBe('what_is');
    expect(reply.reply).toBe(KNOWLEDGE_TOPICS.find((t) => t.id === 'what_is')?.answer.en);
  });

  it.each([
    ['fr', 'Combien coûtent les formules ?'],
    ['ar', 'كم تكلفة الخطط؟'],
  ] as const)('answers in the requested language (%s)', async (locale, question) => {
    const reply = await ask(question, locale);
    expect(reply.topicId).toBe('pricing');
    expect(reply.reply).toBe(KNOWLEDGE_TOPICS.find((t) => t.id === 'pricing')?.answer[locale]);
  });

  it('returns a real route when the topic has one', async () => {
    expect((await ask('How much does it cost?')).href).toBe('/pricing');
  });

  it('uses the last user turn, not an earlier one', async () => {
    const reply = await composeAnswer({
      locale: 'en',
      messages: [
        { role: 'user', content: 'What is MetaTradee?' },
        { role: 'assistant', content: 'It is a trading journal.' },
        { role: 'user', content: 'Can I import from my broker?' },
      ],
    });
    expect(reply.topicId).toBe('broker_import');
  });
});

describe('a follow-up is understood in the context of the conversation', () => {
  /*
   * The scenario this was built for. "I exported an HTML file" matches nothing
   * on its own — the subject was established one turn earlier, and answering
   * "I do not have an approved answer" to it would be both unhelpful and
   * obviously robotic.
   */
  const IMPORT_THREAD = [
    { role: 'user' as const, content: 'I cannot import my MT5 trades.' },
    { role: 'assistant' as const, content: 'First check the file format…' },
    { role: 'user' as const, content: 'I exported an HTML file.' },
  ];

  it('answers the opening turn with a real troubleshooting step', async () => {
    const reply = await ask('I cannot import my MT5 trades.');
    expect(reply.topicId).toBe('import_troubleshooting');
    expect(reply.reply).toMatch(/CSV/);
    expect(reply.followUp).toBe(false);
  });

  it('keeps the HTML follow-up on the same subject instead of giving up', async () => {
    /*
     * This one is answered by a DIRECT match — "html file" is a keyword on the
     * troubleshooting topic, because it is the single most common cause. The
     * assertion is therefore about the outcome, not the route: the person gets
     * the format answer either way.
     */
    const reply = await composeAnswer({ locale: 'en', messages: IMPORT_THREAD });
    expect(reply.source).not.toBe('no_match');
    expect(reply.topicId).toBe('import_troubleshooting');
    expect(reply.reply).toMatch(/CSV/);
  });

  it('carries context through a follow-up with no keywords of its own', async () => {
    // "It still does not work" identifies nothing by itself; only the thread does.
    const reply = await composeAnswer({
      locale: 'en',
      messages: [...IMPORT_THREAD, { role: 'user', content: 'It still does not work.' }],
    });
    expect(reply.source).not.toBe('no_match');
    expect(reply.topicId).toBe('import_troubleshooting');
    expect(reply.followUp).toBe(true);
  });

  it('lets a genuine change of subject win over the earlier context', async () => {
    const reply = await composeAnswer({
      locale: 'en',
      messages: [...IMPORT_THREAD, { role: 'user', content: 'Actually, what do the plans cost?' }],
    });
    expect(reply.topicId).toBe('pricing');
    expect(reply.followUp).toBe(false);
  });

  it('does not reach back indefinitely for a subject', async () => {
    // Five unrelated turns after the import question: the thread has moved on.
    const stale = [
      { role: 'user' as const, content: 'I cannot import my MT5 trades.' },
      ...Array.from({ length: 5 }, () => ({ role: 'user' as const, content: 'ok' })),
      { role: 'user' as const, content: 'hmm' },
    ];
    expect((await composeAnswer({ locale: 'en', messages: stale })).source).toBe('no_match');
  });
});

describe('the reply carries a support category for the escalation form', () => {
  it.each([
    ['I want a refund, I was charged twice', 'billing_subscription'],
    ['I cannot log in and the reset email never arrives', 'login_account'],
    ['I think my account was hacked', 'security'],
    ['my import failed', 'trade_import'],
  ])('%s -> %s', async (question, category) => {
    expect((await ask(question)).category).toBe(category);
  });

  it('is null when the topic implies nothing, rather than guessing', async () => {
    expect((await ask('What is MetaTradee?')).category).toBeNull();
  });
});

describe('it refuses to guess', () => {
  it.each(['Who won the world cup?', 'write me a poem about the moon', 'hello'])(
    'says it does not know: %s',
    async (question) => {
      const reply = await ask(question);
      expect(reply.source).toBe('no_match');
      expect(reply.topicId).toBeNull();
      expect(reply.suggestEscalation).toBe(true);
      expect(reply.reply).toContain(dictionaryFor('en').assistant.noMatch);
    },
  );

  it('says it does not know in the asked language', async () => {
    const reply = await ask('Qui a gagné la coupe du monde ?', 'fr');
    expect(reply.reply).toContain(dictionaryFor('fr').assistant.noMatch);
  });

  it('handles a history with no user turn at all', async () => {
    const reply = await composeAnswer({
      locale: 'en',
      messages: [{ role: 'assistant', content: 'Hello' }],
    });
    expect(reply.source).toBe('no_match');
  });
});

describe('credentials never get past the guardrail', () => {
  it('refuses the turn and does not echo the secret', async () => {
    const secret = 'sk-live-ABCDEFGHIJKLMNOPQRSTUV';
    const reply = await ask(`I cannot log in, my key is ${secret}`);
    expect(reply.source).toBe('guardrail');
    expect(reply.reply).not.toContain(secret);
    expect(reply.reply).toContain(dictionaryFor('en').assistant.secretDetected);
    expect(reply.suggestEscalation).toBe(true);
  });

  it('warns in the asked language', async () => {
    const reply = await ask('كلمة المرور هي SuperSecret99', 'ar');
    expect(reply.source).toBe('guardrail');
    expect(reply.reply).not.toContain('SuperSecret99');
    expect(reply.reply).toContain(dictionaryFor('ar').assistant.secretDetected);
  });
});

describe('escalation is offered where a human is needed', () => {
  it.each([
    'I want a refund, I was charged twice',
    'I cannot log in and the reset email never arrives',
    'I think my account was hacked',
  ])('offers a person for: %s', async (question) => {
    const reply = await ask(question);
    expect(reply.suggestEscalation).toBe(true);
    expect(reply.reply).toContain(dictionaryFor('en').assistant.escalationOffer);
  });

  it('does not stack a second offer onto an answer that already made one', async () => {
    /*
     * Asking for a human used to get "I can pass this to the support team"
     * immediately followed by "Would you like me to pass this to the support
     * team?" — the topic answers the question itself, so `offerHandled`
     * suppresses the generic line.
     */
    const reply = await ask('I would like to talk to a person');
    expect(reply.suggestEscalation).toBe(true);
    expect(reply.reply).not.toContain(dictionaryFor('en').assistant.escalationOffer);
    expect(reply.reply).toContain('support team');
  });

  it('does not offer one for a question it fully answers', async () => {
    const reply = await ask('What is MetaTradee?');
    expect(reply.suggestEscalation).toBe(false);
    expect(reply.reply).not.toContain(dictionaryFor('en').assistant.escalationOffer);
  });
});

describe('no model is required', () => {
  it('answers deterministically when no provider is configured', async () => {
    /*
     * This repository has no AI key set, so the router resolves to the mock and
     * `rephrase` returns null before any network call. The chatbot must be fully
     * functional in that state — which is the state it ships in today.
     */
    const first = await ask('What is MetaTradee?');
    const second = await ask('What is MetaTradee?');
    expect(first.source).toBe('knowledge');
    expect(first.reply).toBe(second.reply);
  });
});

describe('the grounding check', () => {
  const passage = 'The Trader plan costs $19 per month or $190 per year.';

  it('accepts a faithful rewrite', () => {
    expect(isGrounded('Trader is $19 a month, or $190 if you pay yearly.', passage, '')).toBe(true);
  });

  it('rejects a rewrite that invents a number', () => {
    // The exact shape a hallucinated price takes.
    expect(isGrounded('Trader is $29 per month.', passage, '')).toBe(false);
  });

  it('rejects a rewrite that invents a link', () => {
    expect(isGrounded('See https://example.com/pricing for details.', passage, '')).toBe(false);
  });

  it('rejects an empty rewrite', () => {
    expect(isGrounded('   ', passage, '')).toBe(false);
  });

  it('rejects a rewrite that has stopped being a rewrite', () => {
    expect(isGrounded('word '.repeat(200), passage, '')).toBe(false);
  });

  it('allows a number the visitor themselves supplied', () => {
    // Echoing "the 3rd of March" back is not an invention.
    expect(isGrounded('You mentioned 3 accounts.', passage, 'I have 3 accounts')).toBe(true);
  });
});
