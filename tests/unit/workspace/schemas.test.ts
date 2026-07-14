import { describe, it, expect } from 'vitest';
import {
  profileSchema,
  preferencesSchema,
  tradingProfileSchema,
  usernameSchema,
} from '@/features/workspace/schemas';

describe('usernameSchema', () => {
  it('normalizes to lowercase', () => {
    expect(usernameSchema.parse('TraderJoe')).toBe('traderjoe');
  });
  it('rejects reserved and malformed', () => {
    expect(usernameSchema.safeParse('admin').success).toBe(false);
    expect(usernameSchema.safeParse('1abc').success).toBe(false);
  });
});

describe('profileSchema', () => {
  const base = { display_name: 'Joe', username: 'trader_joe' };
  it('accepts a valid profile', () => {
    expect(profileSchema.safeParse(base).success).toBe(true);
  });
  it('requires a display name', () => {
    expect(profileSchema.safeParse({ ...base, display_name: '' }).success).toBe(false);
  });
  it('rejects an overlong bio and bad country code', () => {
    expect(profileSchema.safeParse({ ...base, bio: 'x'.repeat(501) }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, country: 'usa' }).success).toBe(false);
  });
});

describe('preferencesSchema', () => {
  it('accepts partial valid preferences', () => {
    expect(preferencesSchema.safeParse({ theme: 'dark', currency: 'USD' }).success).toBe(true);
  });
  it('rejects invalid enums and out-of-range font scale', () => {
    expect(preferencesSchema.safeParse({ time_format: '48h' }).success).toBe(false);
    expect(preferencesSchema.safeParse({ font_scale: 3 }).success).toBe(false);
  });
});

describe('tradingProfileSchema', () => {
  it('applies array defaults and base currency', () => {
    const parsed = tradingProfileSchema.parse({});
    expect(parsed.markets).toEqual([]);
    expect(parsed.base_currency).toBe('USD');
  });
  it('validates market/goal enum members', () => {
    expect(tradingProfileSchema.safeParse({ markets: ['forex', 'crypto'] }).success).toBe(true);
    expect(tradingProfileSchema.safeParse({ markets: ['nope'] }).success).toBe(false);
  });
});
