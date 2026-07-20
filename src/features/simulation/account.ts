/**
 * Deterministic browser-session demo account.
 *
 * This is a ledger projection, not broker state: the starting cash is a fixed
 * product constant, balance moves only with realized replay P&L, and equity is
 * balance plus unrealized P&L marked from the latest revealed candle. Given the
 * same accounting snapshot it always returns the same result.
 */
import type { AccountingSnapshot } from './accounting';

export const DEFAULT_DEMO_STARTING_BALANCE = 100_000;

export interface DemoAccountSnapshot extends AccountingSnapshot {
  mode: 'simulated';
  currency: 'USD';
  startingBalance: number;
  balance: number;
  equity: number;
}

export function demoAccountSnapshot(
  accounting: AccountingSnapshot,
  startingBalance = DEFAULT_DEMO_STARTING_BALANCE,
): DemoAccountSnapshot {
  if (!Number.isFinite(startingBalance) || startingBalance < 0) {
    throw new Error('Demo starting balance must be a finite non-negative number.');
  }
  const balance = startingBalance + accounting.realizedPnl;
  return Object.freeze({
    ...accounting,
    mode: 'simulated',
    currency: 'USD',
    startingBalance,
    balance,
    equity: balance + (accounting.unrealizedPnl ?? 0),
  });
}

/** Currency display without a leading plus sign, suitable for balances/equity. */
export function formatUsdAmount(value: number): string {
  const sign = value < 0 ? '−' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
