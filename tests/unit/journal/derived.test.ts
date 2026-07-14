import { describe, it, expect } from 'vitest';
import { computeDerivedTradeFields } from '@/features/journal/derived';

describe('computeDerivedTradeFields', () => {
  it('computes gross + net PnL for a long winner', () => {
    const d = computeDerivedTradeFields({
      direction: 'buy',
      entry_price: 100,
      exit_price: 110,
      quantity: 5,
      commission: 2,
      swap: 1,
      fees: 0.5,
    });
    expect(d.pnl).toBe(50); // (110-100)*5
    expect(d.net_pnl).toBe(46.5); // 50 - 3.5
  });

  it('computes PnL for a short (sell) trade', () => {
    const d = computeDerivedTradeFields({
      direction: 'sell',
      entry_price: 100,
      exit_price: 90,
      quantity: 2,
    });
    expect(d.pnl).toBe(20); // (100-90)*2
    expect(d.net_pnl).toBe(20);
  });

  it('returns null PnL when inputs are missing (never fabricates 0)', () => {
    const d = computeDerivedTradeFields({ direction: 'buy', entry_price: 100 });
    expect(d.pnl).toBeNull();
    expect(d.net_pnl).toBeNull();
  });

  it('computes RR from explicit risk/reward and from prices', () => {
    expect(
      computeDerivedTradeFields({
        direction: 'buy',
        risk_amount: 100,
        reward: 250,
      }).rr_ratio,
    ).toBe(2.5);
    // From prices: risk=|100-95|*10=50, reward=|120-100|*10=200 → 4
    expect(
      computeDerivedTradeFields({
        direction: 'buy',
        entry_price: 100,
        stop_loss: 95,
        take_profit: 120,
        quantity: 10,
      }).rr_ratio,
    ).toBe(4);
  });

  it('computes duration and rejects reversed timestamps', () => {
    expect(
      computeDerivedTradeFields({
        direction: 'buy',
        opened_at: '2026-01-01T00:00:00Z',
        closed_at: '2026-01-01T01:30:00Z',
      }).duration_seconds,
    ).toBe(5400);
    expect(
      computeDerivedTradeFields({
        direction: 'buy',
        opened_at: '2026-01-01T02:00:00Z',
        closed_at: '2026-01-01T01:00:00Z',
      }).duration_seconds,
    ).toBeNull();
  });

  it('rounds money to 2 decimals', () => {
    const d = computeDerivedTradeFields({
      direction: 'buy',
      entry_price: 1.23456,
      exit_price: 1.23567,
      quantity: 1000,
    });
    expect(d.pnl).toBe(1.11);
  });
});
