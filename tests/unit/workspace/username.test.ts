import { describe, it, expect } from 'vitest';
import {
  normalizeUsername,
  isReservedUsername,
  isValidUsername,
} from '@/features/workspace/lib/username';

describe('normalizeUsername', () => {
  it('trims and lowercases', () => {
    expect(normalizeUsername('  TraderJoe ')).toBe('traderjoe');
  });
});

describe('isReservedUsername', () => {
  it('flags reserved names case-insensitively', () => {
    expect(isReservedUsername('Admin')).toBe(true);
    expect(isReservedUsername('settings')).toBe(true);
    expect(isReservedUsername('traderjoe')).toBe(false);
  });
});

describe('isValidUsername', () => {
  it('accepts valid handles', () => {
    expect(isValidUsername('trader_joe')).toBe(true);
    expect(isValidUsername('abc')).toBe(true);
    expect(isValidUsername('a1b2c3')).toBe(true);
  });
  it('rejects bad shapes', () => {
    expect(isValidUsername('ab')).toBe(false); // too short
    expect(isValidUsername('1trader')).toBe(false); // starts with a digit
    expect(isValidUsername('trader_')).toBe(false); // trailing underscore
    expect(isValidUsername('Trader Joe')).toBe(false); // space
    expect(isValidUsername('a'.repeat(33))).toBe(false); // too long
  });
  it('rejects reserved names', () => {
    expect(isValidUsername('admin')).toBe(false);
    expect(isValidUsername('API')).toBe(false);
  });
});
