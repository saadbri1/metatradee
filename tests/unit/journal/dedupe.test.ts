import { describe, it, expect } from 'vitest';
import { tradeContentHash, tradePartialKey, classifyDuplicate } from '@/features/journal/dedupe';

const base = {
  trading_account_id: 'acc-1',
  symbol: 'EURUSD',
  direction: 'buy',
  time: '2026-01-01T10:00:00Z',
  quantity: 1,
  entry_price: 1.1,
};

describe('tradeContentHash', () => {
  it('is stable and case/whitespace-insensitive', () => {
    expect(tradeContentHash(base)).toBe(tradeContentHash({ ...base }));
    expect(tradeContentHash(base)).toBe(tradeContentHash({ ...base, symbol: ' eurusd ' }));
  });
  it('differs when a keyed field changes', () => {
    expect(tradeContentHash(base)).not.toBe(tradeContentHash({ ...base, quantity: 2 }));
    expect(tradeContentHash(base)).not.toBe(tradeContentHash({ ...base, direction: 'sell' }));
  });
});

describe('classifyDuplicate', () => {
  it('flags a full duplicate', () => {
    const existing = [{ content_hash: tradeContentHash(base), partial_key: tradePartialKey(base) }];
    expect(classifyDuplicate(base, existing)).toBe('full');
  });

  it('flags a partial duplicate (same trade, different size)', () => {
    const existing = [{ content_hash: tradeContentHash(base), partial_key: tradePartialKey(base) }];
    expect(classifyDuplicate({ ...base, quantity: 3 }, existing)).toBe('partial');
  });

  it('returns none for an unrelated trade', () => {
    const existing = [{ content_hash: tradeContentHash(base), partial_key: tradePartialKey(base) }];
    expect(classifyDuplicate({ ...base, symbol: 'GBPUSD' }, existing)).toBe('none');
  });
});
