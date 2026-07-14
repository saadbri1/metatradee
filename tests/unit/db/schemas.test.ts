import { describe, it, expect } from 'vitest';
import {
  strategyCreateSchema,
  tagCreateSchema,
  tradingAccountCreateSchema,
  attachmentCreateSchema,
  hexColorSchema,
  currencySchema,
} from '@/lib/db/schemas';

describe('hexColorSchema', () => {
  it('accepts 6-digit hex', () => {
    expect(hexColorSchema.safeParse('#5B6CFF').success).toBe(true);
  });
  it('rejects non-hex / shorthand', () => {
    expect(hexColorSchema.safeParse('#FFF').success).toBe(false);
    expect(hexColorSchema.safeParse('blue').success).toBe(false);
  });
});

describe('currencySchema', () => {
  it('accepts 3 uppercase letters', () => {
    expect(currencySchema.safeParse('USD').success).toBe(true);
  });
  it('rejects lowercase / wrong length', () => {
    expect(currencySchema.safeParse('usd').success).toBe(false);
    expect(currencySchema.safeParse('US').success).toBe(false);
  });
});

describe('strategyCreateSchema', () => {
  it('accepts a valid strategy', () => {
    expect(strategyCreateSchema.safeParse({ name: 'Breakout system' }).success).toBe(true);
  });
  it('rejects empty and overlong names', () => {
    expect(strategyCreateSchema.safeParse({ name: '' }).success).toBe(false);
    expect(strategyCreateSchema.safeParse({ name: 'x'.repeat(81) }).success).toBe(false);
  });
  it('rejects a bad color', () => {
    expect(strategyCreateSchema.safeParse({ name: 'ok', color: 'red' }).success).toBe(false);
  });
});

describe('tagCreateSchema', () => {
  it('defaults category to custom', () => {
    const parsed = tagCreateSchema.parse({ name: 'Patience' });
    expect(parsed.category).toBe('custom');
  });
  it('accepts known categories and rejects unknown', () => {
    expect(tagCreateSchema.safeParse({ name: 'FOMO', category: 'mistake' }).success).toBe(true);
    expect(tagCreateSchema.safeParse({ name: 'x', category: 'nope' }).success).toBe(false);
  });
});

describe('tradingAccountCreateSchema', () => {
  it('applies sane defaults', () => {
    const parsed = tradingAccountCreateSchema.parse({ name: 'Main' });
    expect(parsed).toMatchObject({
      account_type: 'live',
      base_currency: 'USD',
      starting_balance: 0,
      status: 'active',
    });
  });
  it('rejects a negative balance and bad currency', () => {
    expect(tradingAccountCreateSchema.safeParse({ name: 'M', starting_balance: -1 }).success).toBe(
      false,
    );
    expect(
      tradingAccountCreateSchema.safeParse({ name: 'M', base_currency: 'dollars' }).success,
    ).toBe(false);
  });
});

describe('attachmentCreateSchema', () => {
  it('requires bucket + path and defaults kind', () => {
    const parsed = attachmentCreateSchema.parse({
      bucket: 'avatars',
      path: 'uid/avatar-1.png',
    });
    expect(parsed.kind).toBe('other');
    expect(attachmentCreateSchema.safeParse({ bucket: 'avatars' }).success).toBe(false);
  });
});
