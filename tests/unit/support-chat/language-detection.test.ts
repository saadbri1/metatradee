/**
 * Automatic language detection.
 *
 * THE ASYMMETRY IS THE POINT. Detecting Arabic from an Arabic message saves
 * someone a trip to a dropdown they cannot read yet. Detecting French from an
 * English sentence that ends in "merci" switches an interface out from under
 * someone for no reason, and they may not know how to switch it back. So the
 * tests below spend as much effort on what must NOT be detected as on what
 * must, and `null` — "leave it exactly as it is" — is treated as a correct
 * answer rather than a failure to decide.
 */
import { describe, expect, it } from 'vitest';
import { detectLocale } from '@/features/support-chat/language-detection';

describe('Arabic', () => {
  it.each([
    'ما هو MetaTradee؟',
    'كم تكلفة الخطط؟',
    'أريد التحدث إلى شخص من فريق الدعم',
    'لا أستطيع استيراد صفقاتي',
  ])('detects %s', (text) => {
    expect(detectLocale(text)).toBe('ar');
  });

  it('wins even when the sentence also contains Latin product names', () => {
    expect(detectLocale('هل يدعم MetaTradee استيراد MT5؟')).toBe('ar');
  });
});

describe('French', () => {
  it.each([
    'Combien coûtent les formules ?',
    'Je ne peux pas importer mes trades',
    'Bonjour, comment puis-je créer un compte ?',
    'Quel est le prix pour une equipe',
  ])('detects %s', (text) => {
    expect(detectLocale(text)).toBe('fr');
  });

  it('detects unaccented French from its function words alone', () => {
    // People type without accents constantly; the markers have to carry it.
    expect(detectLocale('je ne peux pas importer mes trades')).toBe('fr');
  });
});

describe('English', () => {
  it.each([
    'What is MetaTradee?',
    'I cannot import my MT5 trades',
    'How much does the Pro plan cost?',
    'Can you help me with my account',
  ])('detects %s', (text) => {
    expect(detectLocale(text)).toBe('en');
  });
});

describe('it declines to guess when the evidence is thin', () => {
  it.each([
    ['a bare greeting', 'hi'],
    ['a product name alone', 'MetaTradee'],
    ['a single word', 'pricing'],
    ['punctuation only', '???'],
    ['an empty message', '   '],
    ['a number', '42'],
  ])('returns null for %s', (_label, text) => {
    expect(detectLocale(text)).toBeNull();
  });

  it('is not tipped into French by one polite word in an English sentence', () => {
    /*
     * The exact false positive that would be most annoying: an English speaker
     * signing off politely and having the whole widget switch to French.
     */
    expect(detectLocale('Thanks for the help, merci!')).not.toBe('fr');
  });
});
