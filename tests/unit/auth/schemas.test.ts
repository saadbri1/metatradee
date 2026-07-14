import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  passwordSchema,
  signInSchema,
  signUpSchema,
  resetPasswordSchema,
  PASSWORD_POLICY,
} from '@/features/auth/schemas';

describe('emailSchema', () => {
  it('accepts a valid email (trimmed)', () => {
    expect(emailSchema.parse('  user@example.com ')).toBe('user@example.com');
  });
  it('rejects malformed emails', () => {
    expect(emailSchema.safeParse('nope').success).toBe(false);
    expect(emailSchema.safeParse('').success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('accepts a policy-compliant password', () => {
    expect(passwordSchema.safeParse('abcdef1234').success).toBe(true);
  });
  it('rejects too-short passwords', () => {
    expect(passwordSchema.safeParse('a1b2').success).toBe(false);
  });
  it('requires a letter and a number', () => {
    expect(passwordSchema.safeParse('1234567890').success).toBe(false); // no letter
    expect(passwordSchema.safeParse('abcdefghij').success).toBe(false); // no number
  });
  it('enforces the configured minimum length', () => {
    const short = 'a1'.repeat(Math.floor((PASSWORD_POLICY.minLength - 1) / 2));
    expect(passwordSchema.safeParse(short).success).toBe(false);
  });
});

describe('signInSchema', () => {
  it('requires a non-empty password but does not apply strength policy', () => {
    expect(signInSchema.safeParse({ email: 'user@example.com', password: 'x' }).success).toBe(true);
    expect(signInSchema.safeParse({ email: 'user@example.com', password: '' }).success).toBe(false);
  });
  it('treats rememberMe as optional', () => {
    const parsed = signInSchema.parse({
      email: 'user@example.com',
      password: 'secret',
    });
    expect(parsed.rememberMe).toBeUndefined();
    expect(
      signInSchema.safeParse({
        email: 'user@example.com',
        password: 'secret',
        rememberMe: true,
      }).success,
    ).toBe(true);
  });
});

describe('signUpSchema', () => {
  const base = {
    email: 'user@example.com',
    password: 'abcdef1234',
    confirmPassword: 'abcdef1234',
    acceptTerms: true as const,
  };
  it('accepts a valid registration', () => {
    expect(signUpSchema.safeParse(base).success).toBe(true);
  });
  it('rejects mismatched passwords on confirmPassword', () => {
    const result = signUpSchema.safeParse({ ...base, confirmPassword: 'different1' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toBeDefined();
    }
  });
  it('requires accepting the terms', () => {
    expect(signUpSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('rejects mismatched passwords', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'abcdef1234',
      confirmPassword: 'zzzzzz9999',
    });
    expect(result.success).toBe(false);
  });
});
