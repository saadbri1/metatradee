import { describe, it, expect } from 'vitest';
import { tradeCreateSchema, tradeUpdateSchema } from '@/features/journal/schemas';

const valid = {
  symbol: 'EURUSD',
  direction: 'buy' as const,
  entry_price: 1.1,
  exit_price: 1.12,
  quantity: 1000,
};

describe('tradeCreateSchema', () => {
  it('accepts a valid trade and applies defaults', () => {
    const parsed = tradeCreateSchema.parse(valid);
    expect(parsed.currency).toBe('USD');
    expect(parsed.status).toBe('published');
    expect(parsed.visibility).toBe('private');
    expect(parsed.commission).toBe(0);
  });

  it('requires a symbol and a valid direction', () => {
    expect(tradeCreateSchema.safeParse({ ...valid, symbol: '' }).success).toBe(false);
    expect(tradeCreateSchema.safeParse({ ...valid, direction: 'long' }).success).toBe(false);
  });

  it('rejects negative prices/quantity', () => {
    expect(tradeCreateSchema.safeParse({ ...valid, entry_price: -1 }).success).toBe(false);
    expect(tradeCreateSchema.safeParse({ ...valid, quantity: -5 }).success).toBe(false);
  });

  it('rejects close before open', () => {
    const res = tradeCreateSchema.safeParse({
      ...valid,
      opened_at: '2026-01-02T00:00:00Z',
      closed_at: '2026-01-01T00:00:00Z',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.flatten().fieldErrors.closed_at).toBeDefined();
    }
  });

  it('rejects a close time far in the future', () => {
    const future = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
    expect(tradeCreateSchema.safeParse({ ...valid, closed_at: future }).success).toBe(false);
  });
});

describe('tradeUpdateSchema', () => {
  it('allows partial updates', () => {
    expect(tradeUpdateSchema.safeParse({ is_favorite: true }).success).toBe(true);
    expect(tradeUpdateSchema.safeParse({ notes: 'revised' }).success).toBe(true);
  });
});
