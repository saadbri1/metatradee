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
import { SUPPORT_CATEGORIES } from '@/features/contact/schemas';

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
    ['Tell me about the performance calendar', 'calendar'],
    ['how does psychology tracking work', 'psychology'],
    ['what are workspaces', 'workspaces'],
    ['what is a playbook', 'playbook'],
    ['do you have replay', 'replay'],
    ['my import failed', 'import_troubleshooting'],
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

describe('short product tokens match — the regression that shipped silently', () => {
  /*
   * `mt4`, `mt5` and `csv` were declared as keywords and could never match: the
   * old threshold required a keyword of four or more characters, so the three
   * most specific terms a MetaTradee visitor can type were all disqualified.
   * Nothing failed and nothing warned — the bot simply said "I do not have an
   * approved answer" to "can I use CSV imports".
   */
  it.each([
    'can I use CSV imports',
    'is MT4 supported',
    'does MT5 work',
    'do you accept a json file',
  ])('reaches an import topic for: %s', (question) => {
    const id = findTopic(question)?.topic.id;
    expect(['broker_import', 'import_troubleshooting']).toContain(id);
  });

  it('still lets a longer, more specific keyword win over a short one', () => {
    /*
     * "json export" is genuinely ambiguous, and the longest-keyword rule
     * resolves it towards reports rather than imports. Asserted so that
     * lowering the length floor is not mistaken for abandoning specificity.
     */
    expect(findTopic('json export')?.topic.id).toBe('reports');
  });
});

describe('the shipped-versus-unbuilt line stays sharp', () => {
  it('describes replay as shipped, and says plainly it is not a backtester', () => {
    const answer = findTopic('do you have replay')?.topic.answer.en ?? '';
    expect(answer).toMatch(/shipped|available/i);
    expect(answer).toMatch(/not a backtester/i);
  });

  it('never presents backtesting as live', () => {
    const answer = findTopic('do you support backtesting')?.topic.answer.en ?? '';
    expect(answer).toMatch(/not built yet/i);
    expect(answer).not.toMatch(/\bis available\b|\bshipped\b/i);
  });
});

describe('import answers match the import engine, not a memory of it', () => {
  it('names only the formats the parser actually reads', () => {
    const answer = findTopic('can I import from my broker')?.topic.answer.en ?? '';
    expect(answer).toContain('CSV');
    expect(answer).toContain('JSON');
    // There is no HTML statement parser anywhere in this repository.
    expect(answer).not.toMatch(/\bHTML\b/);
  });

  it('gives the HTML-statement troubleshooting step rather than a shrug', () => {
    const answer = findTopic('the import failed, I used an html file')?.topic.answer.en ?? '';
    expect(answer).toMatch(/HTML/);
    expect(answer).toMatch(/re-export|CSV/i);
  });
});

describe('topics carry a support category where one is obvious', () => {
  it.each([
    ['billing_issue', 'billing_subscription'],
    ['account_access', 'login_account'],
    ['security_concern', 'security'],
    ['import_troubleshooting', 'trade_import'],
  ])('%s -> %s', (id, category) => {
    expect(KNOWLEDGE_TOPICS.find((t) => t.id === id)?.category).toBe(category);
  });

  it('uses only categories the contact schema defines', () => {
    for (const topic of KNOWLEDGE_TOPICS) {
      if (!topic.category) continue;
      expect(SUPPORT_CATEGORIES, topic.id).toContain(topic.category);
    }
  });
});
