import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DEMO_STARTING_BALANCE,
  accountingSnapshot,
  demoAccountSnapshot,
  formatUsdAmount,
} from '@/features/simulation';
import { INSTRUMENT_SPECIFICATIONS } from '@/features/simulation/instruments';
import type { SimulatedFill } from '@/features/simulation/types';

const ES = INSTRUMENT_SPECIFICATIONS.ES;

function fill(
  sequence: number,
  side: 'buy' | 'sell',
  quantity: number,
  price: number,
): SimulatedFill {
  return {
    sequence,
    orderId: `order-${sequence}`,
    side,
    quantity,
    price,
    candleTime: 1_654_548_600 + sequence * 60,
    cursor: sequence,
    role: 'entry',
  };
}

describe('deterministic demo account', () => {
  it('starts with fixed virtual cash and equal equity', () => {
    const account = demoAccountSnapshot(accountingSnapshot([], ES, 4100));
    expect(account).toMatchObject({
      mode: 'simulated',
      currency: 'USD',
      startingBalance: DEFAULT_DEMO_STARTING_BALANCE,
      balance: DEFAULT_DEMO_STARTING_BALANCE,
      equity: DEFAULT_DEMO_STARTING_BALANCE,
      side: 'flat',
    });
  });

  it('moves equity with revealed-price P&L without realizing cash', () => {
    const accounting = accountingSnapshot([fill(1, 'buy', 2, 4100)], ES, 4103);
    const account = demoAccountSnapshot(accounting);
    expect(account.balance).toBe(100_000);
    expect(account.unrealizedPnl).toBe(300);
    expect(account.equity).toBe(100_300);
  });

  it('moves balance only when a position is reduced or closed', () => {
    const fills = [fill(1, 'buy', 3, 4100), fill(2, 'sell', 1, 4104)];
    const account = demoAccountSnapshot(accountingSnapshot(fills, ES, 4105));
    expect(account.realizedPnl).toBe(200);
    expect(account.balance).toBe(100_200);
    expect(account.unrealizedPnl).toBe(500);
    expect(account.equity).toBe(100_700);
    expect(account).toMatchObject({ side: 'long', quantity: 2, averageEntryPrice: 4100 });
  });

  it('is byte-identical for the same accounting input', () => {
    const accounting = accountingSnapshot([fill(1, 'sell', 1, 4100)], ES, 4095);
    expect(demoAccountSnapshot(accounting)).toEqual(demoAccountSnapshot(accounting));
  });

  it('rejects invalid starting cash instead of silently inventing account state', () => {
    const accounting = accountingSnapshot([], ES, 4100);
    expect(() => demoAccountSnapshot(accounting, Number.NaN)).toThrow(/starting balance/i);
    expect(() => demoAccountSnapshot(accounting, -1)).toThrow(/starting balance/i);
  });

  it('formats account money without a misleading positive P&L sign', () => {
    expect(formatUsdAmount(100_000)).toBe('$100,000.00');
    expect(formatUsdAmount(-25.5)).toBe('−$25.50');
  });
});
