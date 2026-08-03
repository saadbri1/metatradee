/**
 * Translation completeness and the exact required copy.
 *
 * The failure this guards against is a key that exists in English and silently
 * renders as `undefined` — or worse, as English — in Arabic. TypeScript catches
 * a MISSING key; only a test catches a key that was added, translated by
 * copy-paste, and left identical to the source language.
 */
import { describe, expect, it } from 'vitest';
import {
  SUPPORT_CHAT_TRANSLATIONS,
  LOCALE_OPTIONS,
  dictionaryFor,
} from '@/features/support-chat/translations';
import {
  LOCALE_DIRECTION,
  LOCALE_HTML_LANG,
  SUPPORT_CHAT_LOCALES,
  isSupportChatLocale,
} from '@/features/support-chat/types';
import { SUPPORT_CATEGORIES } from '@/features/contact/schemas';

/** Walk a dictionary and collect every leaf string, with its path. */
function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  }
  return [];
}

describe('every locale is complete', () => {
  it('covers all three languages', () => {
    expect(Object.keys(SUPPORT_CHAT_TRANSLATIONS).sort()).toEqual(['ar', 'en', 'fr']);
  });

  it.each(SUPPORT_CHAT_LOCALES)('has no empty string anywhere (%s)', (locale) => {
    for (const [path, text] of leaves(dictionaryFor(locale))) {
      expect(text.trim(), `${locale}.${path} is empty`).not.toBe('');
    }
  });

  it('has the identical key set in every language', () => {
    const paths = (locale: (typeof SUPPORT_CHAT_LOCALES)[number]) =>
      leaves(dictionaryFor(locale))
        .map(([path]) => path)
        .sort();
    expect(paths('fr')).toEqual(paths('en'));
    expect(paths('ar')).toEqual(paths('en'));
  });

  it('translates the support categories the contact schema defines', () => {
    // Keyed by SupportCategory, so a new category cannot ship untranslated.
    for (const locale of SUPPORT_CHAT_LOCALES) {
      const categories = dictionaryFor(locale).categories;
      expect(Object.keys(categories).sort()).toEqual([...SUPPORT_CATEGORIES].sort());
    }
  });
});

describe('the copy is actually translated, not copied', () => {
  /*
   * The brand name is the same in every language, the language selector
   * deliberately shows native names everywhere, and the quick-action ids are
   * stable machine keys rather than copy — those are the only legitimate
   * duplicates.
   */
  const SHARED_BY_DESIGN =
    /^(assistantName|languageName|languageSelector\.options\.|quickActions\[\d+\]\.id$)/;

  it.each(['fr', 'ar'] as const)('differs from English almost everywhere (%s)', (locale) => {
    const english = new Map(leaves(dictionaryFor('en')));
    const identical = leaves(dictionaryFor(locale)).filter(
      ([path, text]) => english.get(path) === text && !SHARED_BY_DESIGN.test(path),
    );
    expect(identical).toEqual([]);
  });
});

describe('the required welcome messages are exact', () => {
  it('English', () => {
    expect(dictionaryFor('en').welcome).toBe(
      'Hi! I’m the MetaTradee Assistant. How can I help you today?',
    );
  });

  it('French', () => {
    expect(dictionaryFor('fr').welcome).toBe(
      'Bonjour ! Je suis l’assistant MetaTradee. Comment puis-je vous aider aujourd’hui ?',
    );
  });

  it('Arabic', () => {
    expect(dictionaryFor('ar').welcome).toBe(
      'مرحباً! أنا مساعد MetaTradee. كيف يمكنني مساعدتك اليوم؟',
    );
  });
});

describe('the required privacy warnings are exact', () => {
  it('English', () => {
    expect(dictionaryFor('en').privacyWarning).toBe('Do not share passwords or API keys.');
  });

  it('French', () => {
    expect(dictionaryFor('fr').privacyWarning).toBe(
      'Ne partagez pas de mots de passe ni de clés API.',
    );
  });

  it('Arabic', () => {
    expect(dictionaryFor('ar').privacyWarning).toBe('لا تشارك كلمات المرور أو مفاتيح API.');
  });
});

describe('direction is declared per locale', () => {
  it('flips only Arabic', () => {
    expect(LOCALE_DIRECTION).toEqual({ en: 'ltr', fr: 'ltr', ar: 'rtl' });
  });

  it('carries a BCP-47 tag for each locale', () => {
    expect(LOCALE_HTML_LANG).toEqual({ en: 'en', fr: 'fr', ar: 'ar' });
  });
});

describe('locale guard', () => {
  it('accepts only the three supported tags', () => {
    expect(SUPPORT_CHAT_LOCALES.every(isSupportChatLocale)).toBe(true);
    for (const bad of ['de', 'EN', '', null, undefined, 42, {}]) {
      expect(isSupportChatLocale(bad)).toBe(false);
    }
  });
});

describe('the language selector', () => {
  it('offers every locale under its native name', () => {
    expect(LOCALE_OPTIONS).toEqual([
      { value: 'en', label: 'English' },
      { value: 'fr', label: 'Français' },
      { value: 'ar', label: 'العربية' },
    ]);
  });
});
