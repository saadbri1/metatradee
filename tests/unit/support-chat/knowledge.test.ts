/**
 * The approved knowledge base.
 *
 * TWO PROPERTIES MATTER HERE, and they pull against each other:
 *
 *   IT MUST MATCH what people actually type, in three languages and with the
 *   spelling variants each of them produces.
 *
 *   IT MUST NOT MATCH everything else. A support bot that answers "pricing" to
 *   an unrelated sentence is worse than one that admits it does not know, which
 *   is why `MIN_SCORE` exists and why the negative cases below are as important
 *   as the positive ones.
 *
 * And one honesty property: the prices are DERIVED from `plans.ts`, so this
 * file asserts the derivation rather than the numbers — a test that hardcoded
 * "$19" would just be a second place for the price to go stale.
 */
import { describe, expect, it } from 'vitest';
import {
  KNOWLEDGE_TOPICS,
  answerFor,
  findTopic,
  normalizeForMatch,
  passagesFor,
} from '@/features/support-chat/knowledge';
import { SUPPORT_CHAT_LOCALES } from '@/features/support-chat/types';
import { COMING_SOON, PLANS } from '@/features/billing/plans';
import { TIER_ORDER, formatPrice, priceFor } from '@/features/billing/pricing';

describe('every topic is complete', () => {
  it('has an answer in all three languages', () => {
    for (const topic of KNOWLEDGE_TOPICS) {
      for (const locale of SUPPORT_CHAT_LOCALES) {
        expect(topic.answer[locale].trim(), `${topic.id}/${locale}`).not.toBe('');
        expect(topic.keywords[locale].length, `${topic.id}/${locale} keywords`).toBeGreaterThan(0);
      }
    }
  });

  it('uses unique ids', () => {
    const ids = KNOWLEDGE_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only ever links to a real public route', () => {
    // Every route below exists under src/app. No placeholders, no dead links.
    const PUBLIC_ROUTES = ['/products', '/pricing', '/brokers', '/support', '/contact'];
    for (const topic of KNOWLEDGE_TOPICS) {
      if (!topic.href) continue;
      const path = topic.href.split('#')[0];
      expect(PUBLIC_ROUTES, `${topic.id} -> ${topic.href}`).toContain(path);
    }
  });

  it('exposes every passage for the grounding check', () => {
    expect(passagesFor('en')).toHaveLength(KNOWLEDGE_TOPICS.length);
  });
});

describe('normalisation', () => {
  it('folds Latin accents and case', () => {
    expect(normalizeForMatch('Combien Coûtent les Formules ?')).toBe(
      'combien coutent les formules',
    );
  });

  it('folds Arabic diacritics and letter variants', () => {
    // إستيراد / استيراد / اسْتيراد must all normalise to the same string.
    expect(normalizeForMatch('إستيراد')).toBe(normalizeForMatch('استيراد'));
    expect(normalizeForMatch('اسْتيراد')).toBe(normalizeForMatch('استيراد'));
  });

  it('keeps Arabic letters that a `\\W` strip would delete', () => {
    expect(normalizeForMatch('ما هو MetaTradee؟')).toBe('ما هو metatradee');
  });
});

describe('matching finds the right topic', () => {
  it.each([
    ['What is MetaTradee?', 'what_is'],
    ['How much does it cost?', 'pricing'],
    ['Can I import my trade history from my broker?', 'broker_import'],
    ['I want a refund, I was charged twice', 'billing_issue'],
    ['I would like to talk to a person', 'human_support'],
    ['Do you do backtesting?', 'coming_soon'],
  ])('English: %s', (question, expected) => {
    expect(findTopic(question)?.topic.id).toBe(expected);
  });

  it.each([
    ['Qu’est-ce que MetaTradee ?', 'what_is'],
    ['Combien coûtent les formules ?', 'pricing'],
    ['Puis-je importer mon historique depuis mon courtier ?', 'broker_import'],
    ['Je veux parler à un conseiller', 'human_support'],
  ])('French: %s', (question, expected) => {
    expect(findTopic(question)?.topic.id).toBe(expected);
  });

  it.each([
    ['ما هو MetaTradee؟', 'what_is'],
    ['كم تكلفة الخطط؟', 'pricing'],
    ['هل يمكنني استيراد صفقاتي من الوسيط؟', 'broker_import'],
    ['أريد التحدث إلى شخص من فريق الدعم', 'human_support'],
  ])('Arabic: %s', (question, expected) => {
    expect(findTopic(question)?.topic.id).toBe(expected);
  });

  it('matches an English question asked while the panel is set to Arabic', () => {
    /*
     * Keywords are matched across ALL locales precisely for this: people switch
     * the interface language and then type in whichever language they think in.
     */
    const match = findTopic('what is the price?');
    expect(match?.topic.id).toBe('pricing');
    // The topic is found from English keywords; the ANSWER comes back in Arabic.
    expect(answerFor(match!.topic, 'ar')).toContain('خطط');
  });

  it('prefers the longer, more specific phrase', () => {
    // "plan" alone would hit `pricing`; the full phrase must win for `what_is`.
    expect(findTopic('what is metatradee, and does it have a plan')?.topic.id).toBe('what_is');
  });
});

describe('matching refuses to guess', () => {
  it.each([
    'hello',
    'thanks!',
    'Who won the world cup?',
    'is it?',
    'Please write my dissertation about medieval pottery',
  ])('returns null for: %s', (question) => {
    expect(findTopic(question)).toBeNull();
  });

  it('returns null for an empty message', () => {
    expect(findTopic('   ')).toBeNull();
  });
});

describe('the answers stay honest', () => {
  it('quotes prices derived from the plan configuration', () => {
    const answer = findTopic('how much does it cost')?.topic.answer.en ?? '';
    for (const tier of TIER_ORDER) {
      const { monthly, currency } = priceFor(tier);
      expect(answer).toContain(PLANS[tier].name);
      if (monthly > 0) expect(answer).toContain(formatPrice(monthly, currency));
    }
  });

  it('names the unbuilt features exactly as `plans.ts` names them', () => {
    const answer = findTopic('do you support backtesting')?.topic.answer.en ?? '';
    for (const label of Object.values(COMING_SOON)) expect(answer).toContain(label);
  });

  it('never promises returns or gives a trade call', () => {
    const FORBIDDEN =
      /\b(guaranteed|profitable returns|you should buy|you should sell|will rise|will fall)\b/i;
    for (const topic of KNOWLEDGE_TOPICS) {
      for (const locale of SUPPORT_CHAT_LOCALES) {
        expect(topic.answer[locale], `${topic.id}/${locale}`).not.toMatch(FORBIDDEN);
      }
    }
  });

  it('routes money, access and security questions to a human', () => {
    for (const id of ['billing_issue', 'account_access', 'security_concern', 'human_support']) {
      expect(KNOWLEDGE_TOPICS.find((t) => t.id === id)?.escalate, id).toBe(true);
    }
  });

  it('tells people not to send credentials when the topic invites it', () => {
    // The two topics where someone is most likely to paste a password.
    expect(findTopic('I cannot log in')?.topic.answer.en).toMatch(/never send your password/i);
    expect(findTopic('my account was hacked')?.topic.answer.en).toMatch(/never ask for them/i);
  });
});
