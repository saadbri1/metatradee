/**
 * Credential detection and redaction.
 *
 * The composer carries a standing warning — "Do not share passwords or API
 * keys" — and some people will paste one anyway, usually while panicking about
 * a locked account. This module is what makes that warning more than
 * decoration: a detected secret is REPLACED before the text is stored in the
 * conversation, before it is sent to any model, and before it reaches an email
 * body. Nothing downstream ever sees the original.
 *
 * PURE. No clock, no network, no state — every rule here is directly testable,
 * and the same function runs on the client (to warn) and on the server (to
 * redact), so the two can never disagree about what counts as a secret.
 *
 * DELIBERATELY OVER-EAGER. A false positive costs the user one retyped
 * sentence. A false negative puts a live API key in an inbox and a log.
 */

export type SecretKind = 'api_key' | 'password' | 'token' | 'card_number';

/** What replaces a detected secret. Names the kind so the user knows why. */
const MASK: Record<SecretKind, string> = {
  api_key: '[api key removed]',
  password: '[password removed]',
  token: '[token removed]',
  card_number: '[card number removed]',
};

interface Rule {
  kind: SecretKind;
  re: RegExp;
}

/*
 * Labelled-secret rules, in three languages. The label is KEPT and only the
 * value is masked, so "my password is [password removed]" still reads as a
 * sentence and support can see what the person was trying to tell them.
 */
const LABELLED: Rule[] = [
  {
    kind: 'password',
    /*
     * "password", not a bare "pass" — "I can't pass verification: 12345678" is
     * a sentence support needs to read, not a credential.
     */
    re: /((?:password|passwd|pwd|mot de passe|motdepasse|كلمة المرور|كلمة السر)\s*(?:is|est|:|=|هي)\s*)(\S{4,})/gi,
  },
  {
    kind: 'api_key',
    re: /((?:api[\s_-]?key|clé api|cle api|مفتاح api)\s*(?:is|est|:|=|هو)\s*)(\S{8,})/gi,
  },
  {
    kind: 'token',
    re: /((?:token|jeton|secret|رمز|توكن)\s*(?:is|est|:|=|هو)\s*)(\S{8,})/gi,
  },
];

/*
 * Shape-based rules. These need no label at all — a raw `sk-…` pasted on its
 * own line is still a key.
 */
const SHAPED: Rule[] = [
  // Common provider prefixes: OpenAI/Stripe/Resend/GitHub/Slack/Google/AWS.
  {
    kind: 'api_key',
    re: /\b(?:sk|pk|rk)[-_](?:live|test|proj|ant)?[-_]?[A-Za-z0-9]{16,}\b/g,
  },
  { kind: 'api_key', re: /\bre_[A-Za-z0-9_-]{16,}\b/g },
  { kind: 'api_key', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { kind: 'api_key', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { kind: 'api_key', re: /\bAIza[A-Za-z0-9_-]{20,}\b/g },
  { kind: 'api_key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  // Bearer credentials and JWTs.
  { kind: 'token', re: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/gi },
  { kind: 'token', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
];

/** Digit runs that could be a card number, before the Luhn check. */
const CARD_CANDIDATE = /\b(?:\d[ -]?){13,19}\b/g;

/** Luhn checksum. A 16-digit order id is not a card; a valid checksum is. */
export function looksLikeCardNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export interface RedactionResult {
  /** The text with every detected secret replaced. Safe to store and send. */
  text: string;
  /** Distinct kinds found, in detection order. Empty when nothing matched. */
  kinds: SecretKind[];
  found: boolean;
}

/**
 * Strip anything credential-shaped out of `input`.
 *
 * Returns a NEW string; the original is never mutated and — by contract with
 * every caller — never persisted. Callers must use `result.text`, which is why
 * this returns a result object rather than a boolean plus the input.
 */
export function redactSecrets(input: string): RedactionResult {
  const kinds: SecretKind[] = [];
  const note = (kind: SecretKind) => {
    if (!kinds.includes(kind)) kinds.push(kind);
  };

  let text = input;

  /*
   * Every LABELLED rule captures the label as group 1 and the value as group 2.
   * Only group 2 is masked, so the sentence survives and support can still see
   * what the person was trying to say.
   */
  for (const rule of LABELLED) {
    text = text.replace(rule.re, (_match: string, label: string) => {
      note(rule.kind);
      return `${label}${MASK[rule.kind]}`;
    });
  }

  for (const rule of SHAPED) {
    text = text.replace(rule.re, () => {
      note(rule.kind);
      return MASK[rule.kind];
    });
  }

  text = text.replace(CARD_CANDIDATE, (match) => {
    if (!looksLikeCardNumber(match)) return match;
    note('card_number');
    return MASK.card_number;
  });

  return { text, kinds, found: kinds.length > 0 };
}

/** Cheap predicate for the client-side warning. Same rules, no allocation. */
export function containsSecret(input: string): boolean {
  return redactSecrets(input).found;
}
