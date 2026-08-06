/**
 * Which language is the visitor writing in?
 *
 * WHY THIS EXISTS. Someone who opens the widget and types a question in Arabic
 * has already told us what language they want. Making them find a dropdown
 * first — in an interface currently rendered in English — is the exact friction
 * a support widget is supposed to remove.
 *
 * PURE, AND DELIBERATELY CONSERVATIVE. It returns `null` far more often than it
 * guesses. Switching someone's interface to French because they wrote "merci"
 * at the end of an English sentence is worse than leaving it alone, so a match
 * needs real evidence and a clear margin over the alternative.
 *
 * IT NEVER OVERRIDES A PERSON. The caller only consults this while the language
 * is still automatic; the moment someone picks from the selector, detection
 * stops for good. See `use-support-chat.ts`.
 */
import { normalizeForMatch } from './knowledge';
import type { SupportChatLocale } from './types';

/**
 * Arabic script. Presence is decisive on its own — no other supported language
 * uses it, so there is nothing to weigh it against.
 */
const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** Letters French uses and English does not. Strong, cheap evidence. */
const FRENCH_DIACRITICS = /[àâäçéèêëîïôöùûüÿœ]/i;

/*
 * Function words. These are the words a person cannot avoid writing in their
 * own language, which makes them far better evidence than topic vocabulary —
 * "import" and "trading" appear in all three languages here.
 */
const FRENCH_MARKERS = [
  'je',
  'mon',
  'ma',
  'mes',
  'vous',
  'nous',
  'est',
  'ce',
  'cette',
  'quoi',
  'quel',
  'quelle',
  'comment',
  'pourquoi',
  'combien',
  'puis',
  'peux',
  'pouvez',
  'avec',
  'pour',
  'dans',
  'sur',
  'les',
  'des',
  'une',
  'aux',
  'du',
  'au',
  'pas',
  'plus',
  'bonjour',
  'merci',
  'salut',
  'aide',
  'aider',
  'compte',
  'tarif',
  'tarifs',
  'prix',
  'essai',
  'gratuit',
];

const ENGLISH_MARKERS = [
  'the',
  'is',
  'are',
  'was',
  'what',
  'how',
  'why',
  'can',
  'cant',
  'cannot',
  'do',
  'does',
  'my',
  'your',
  'you',
  'and',
  'with',
  'for',
  'from',
  'this',
  'that',
  'have',
  'need',
  'want',
  'help',
  'please',
  'hello',
  'thanks',
  'about',
  'account',
  'price',
  'pricing',
  'free',
  'trial',
];

/** How many marker words from `list` appear as whole tokens in `tokens`. */
function hits(tokens: Set<string>, list: string[]): number {
  let count = 0;
  for (const marker of list) if (tokens.has(marker)) count += 1;
  return count;
}

/**
 * Detected language, or `null` when the evidence is not clear enough.
 *
 * `null` is a first-class answer and the caller must treat it as "leave the
 * language exactly as it is". A short message like "hi" or a bare product name
 * genuinely does not identify a language, and pretending otherwise would make
 * the interface flip under people mid-conversation.
 */
export function detectLocale(text: string): SupportChatLocale | null {
  if (ARABIC_SCRIPT.test(text)) return 'ar';

  // Accented French letters are decisive: English does not use them natively.
  if (FRENCH_DIACRITICS.test(text)) return 'fr';

  const tokens = new Set(normalizeForMatch(text).split(' ').filter(Boolean));
  // Below this there is not enough text to tell "merci" from a French sentence.
  if (tokens.size < 2) return null;

  const french = hits(tokens, FRENCH_MARKERS);
  const english = hits(tokens, ENGLISH_MARKERS);

  /*
   * A clear margin, not a bare majority. One shared-looking word must not tip
   * a sentence, so the winner needs at least two markers and strictly more than
   * the runner-up.
   */
  if (french >= 2 && french > english) return 'fr';
  if (english >= 2 && english > french) return 'en';
  return null;
}
