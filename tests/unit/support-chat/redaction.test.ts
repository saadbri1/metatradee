/**
 * Credential redaction.
 *
 * THE LOAD-BEARING ASSERTION is that the ORIGINAL VALUE is gone from the
 * output. It is not enough to detect a secret and flag it: the returned text is
 * what gets stored in the transcript, sent to a model, and written into an
 * email body, so a test that only checked `found === true` would pass while a
 * live API key travelled to an inbox.
 */
import { describe, expect, it } from 'vitest';
import {
  containsSecret,
  looksLikeCardNumber,
  redactSecrets,
} from '@/features/support-chat/redaction';

describe('shaped secrets are removed without needing a label', () => {
  it.each([
    ['sk-proj-AbCdEfGhIjKlMnOpQrStUv1234', 'api_key'],
    ['re_1234567890abcdefghijkl', 'api_key'],
    ['ghp_abcdefghijklmnopqrstuvwxyz0123456789', 'api_key'],
    ['xoxb-1234567890-abcdefghij', 'api_key'],
    ['AIzaSyA1234567890abcdefghijklmnopqrst', 'api_key'],
    ['AKIAIOSFODNN7EXAMPLE', 'api_key'],
    ['Bearer abcdefghijklmnopqrstuvwxyz012345', 'token'],
    ['eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.dBjftJeZ4CVPmB92', 'token'],
  ])('removes %s', (secret, kind) => {
    const result = redactSecrets(`here it is: ${secret} — please check`);
    expect(result.found).toBe(true);
    expect(result.kinds).toContain(kind);
    // The value itself must be gone, not merely reported.
    expect(result.text).not.toContain(secret);
    expect(result.text).toContain('please check');
  });
});

describe('labelled secrets keep the sentence and lose the value', () => {
  it('English', () => {
    const result = redactSecrets('my password is Hunter2Hunter2');
    expect(result.text).toBe('my password is [password removed]');
    expect(result.kinds).toEqual(['password']);
  });

  it('French', () => {
    const result = redactSecrets('mon mot de passe est Tr0ub4dour');
    expect(result.text).toContain('[password removed]');
    expect(result.text).not.toContain('Tr0ub4dour');
  });

  it('Arabic', () => {
    const result = redactSecrets('كلمة المرور هي SuperSecret99');
    expect(result.text).toContain('[password removed]');
    expect(result.text).not.toContain('SuperSecret99');
  });

  it('catches an api key introduced by name', () => {
    const result = redactSecrets('api key: ABCD1234EFGH5678');
    expect(result.found).toBe(true);
    expect(result.text).not.toContain('ABCD1234EFGH5678');
  });
});

describe('card numbers', () => {
  it('accepts only a valid Luhn checksum', () => {
    expect(looksLikeCardNumber('4242 4242 4242 4242')).toBe(true);
    expect(looksLikeCardNumber('4242424242424241')).toBe(false);
    expect(looksLikeCardNumber('123')).toBe(false);
  });

  it('removes a pasted card number', () => {
    const result = redactSecrets('I was charged on 4242 4242 4242 4242 twice');
    expect(result.kinds).toContain('card_number');
    expect(result.text).not.toContain('4242 4242 4242 4242');
    expect(result.text).toContain('twice');
  });

  it('leaves a long reference number that is not a card alone', () => {
    // Support needs to read an order id; it is not a credential.
    const result = redactSecrets('my invoice reference is 1234567890123456');
    expect(result.kinds).not.toContain('card_number');
    expect(result.text).toContain('1234567890123456');
  });
});

describe('ordinary support messages are left intact', () => {
  it.each([
    'I cannot log in to my account, can you help?',
    'Je ne peux pas me connecter à mon compte.',
    'لا أستطيع تسجيل الدخول إلى حسابي.',
    'The import failed for my MT5 file from January.',
    'I could not pass the verification step yesterday.',
  ])('leaves %s unchanged', (message) => {
    const result = redactSecrets(message);
    expect(result.found).toBe(false);
    expect(result.text).toBe(message);
  });
});

describe('containsSecret mirrors redactSecrets exactly', () => {
  it('agrees on both a hit and a miss', () => {
    expect(containsSecret('sk-live-ABCDEFGHIJKLMNOPQRST')).toBe(true);
    expect(containsSecret('what does the Pro plan include?')).toBe(false);
  });
});
