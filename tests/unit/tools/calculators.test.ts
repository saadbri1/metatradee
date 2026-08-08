/**
 * The public calculators.
 *
 * THESE ARE THE HIGHEST-STAKES PURE FUNCTIONS ON THE PUBLIC SITE. They are the
 * first thing a stranger from a search result uses, unauthenticated, and they
 * tell someone how much of their account to put at risk. A wrong answer here is
 * not a layout bug.
 *
 * Every case below is hand-checkable arithmetic rather than a snapshot, so a
 * reviewer can confirm the expected number without running anything. The
 * rejection cases matter as much as the happy path: a zero stop distance
 * divides to `Infinity`, which renders as a position size no account could take
 * and looks like an answer.
 */
import { describe, expect, it } from 'vitest';
import {
  calculatePositionSize,
  pipsToPrice,
  priceToPips,
  roundLotsDown,
} from '@/features/tools/position-size';
import { calculateRiskReward } from '@/features/tools/risk-reward';
import { INSTRUMENTS, instrumentById } from '@/features/tools/instruments';

describe('position size — gold', () => {
  const gold = instrumentById('xauusd')!;

  it('sizes a $5 stop on a $20,000 account risking 1%', () => {
    /*
     * Risk        = 20,000 × 1%      = $200
     * Loss/lot    = $5 × 100 oz      = $500
     * Lots        = 200 ÷ 500        = 0.4
     */
    const outcome = calculatePositionSize({
      balance: 20_000,
      riskPercent: 1,
      stopDistance: 5,
      contractSize: gold.contractSize,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.riskAmount).toBe(200);
    expect(outcome.result.lossPerLot).toBe(500);
    expect(outcome.result.lots).toBeCloseTo(0.4, 10);
    expect(outcome.result.units).toBeCloseTo(40, 10);
  });

  it('halves the size when the stop doubles', () => {
    const base = { balance: 10_000, riskPercent: 1, contractSize: gold.contractSize };
    const tight = calculatePositionSize({ ...base, stopDistance: 4 });
    const wide = calculatePositionSize({ ...base, stopDistance: 8 });
    if (!tight.ok || !wide.ok) throw new Error('expected both to compute');
    expect(wide.result.lots).toBeCloseTo(tight.result.lots / 2, 10);
  });
});

describe('position size — forex', () => {
  const eurusd = instrumentById('eurusd')!;

  it('sizes a 20-pip stop on a $10,000 account risking 2%', () => {
    /*
     * Stop        = 20 pips × 0.0001 = 0.0020
     * Risk        = 10,000 × 2%      = $200
     * Loss/lot    = 0.0020 × 100,000 = $200
     * Lots        = 200 ÷ 200        = 1.0
     */
    const outcome = calculatePositionSize({
      balance: 10_000,
      riskPercent: 2,
      stopDistance: pipsToPrice(20, eurusd.pipSize),
      contractSize: eurusd.contractSize,
    });
    if (!outcome.ok) throw new Error('expected a result');
    expect(outcome.result.riskAmount).toBeCloseTo(200, 10);
    expect(outcome.result.lossPerLot).toBeCloseTo(200, 10);
    expect(outcome.result.lots).toBeCloseTo(1, 10);
  });

  it('scales linearly with account size', () => {
    const shape = {
      riskPercent: 1,
      stopDistance: pipsToPrice(25, eurusd.pipSize),
      contractSize: eurusd.contractSize,
    };
    const small = calculatePositionSize({ ...shape, balance: 5_000 });
    const large = calculatePositionSize({ ...shape, balance: 50_000 });
    if (!small.ok || !large.ok) throw new Error('expected both to compute');
    expect(large.result.lots).toBeCloseTo(small.result.lots * 10, 10);
  });
});

describe('position size refuses what it cannot answer', () => {
  const valid = { balance: 10_000, riskPercent: 1, stopDistance: 5, contractSize: 100 };

  it.each([
    ['a zero stop — would divide to Infinity', { stopDistance: 0 }, 'stop_invalid'],
    ['a negative stop', { stopDistance: -5 }, 'stop_invalid'],
    ['a zero balance', { balance: 0 }, 'balance_invalid'],
    ['a negative balance', { balance: -100 }, 'balance_invalid'],
    ['zero risk', { riskPercent: 0 }, 'risk_invalid'],
    ['risk above 100%', { riskPercent: 101 }, 'risk_invalid'],
    ['a zero contract size', { contractSize: 0 }, 'contract_invalid'],
    ['NaN anywhere', { balance: Number.NaN }, 'balance_invalid'],
    ['Infinity anywhere', { stopDistance: Number.POSITIVE_INFINITY }, 'stop_invalid'],
  ])('rejects %s', (_label, override, error) => {
    const outcome = calculatePositionSize({ ...valid, ...override });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toBe(error);
  });

  it('never returns a non-finite size on any accepted input', () => {
    const outcome = calculatePositionSize({ ...valid, stopDistance: 0.0001 });
    if (!outcome.ok) throw new Error('expected a result');
    expect(Number.isFinite(outcome.result.lots)).toBe(true);
  });
});

describe('pip conversion round-trips', () => {
  it.each(INSTRUMENTS.map((i) => [i.symbol, i.pipSize] as const))(
    '%s converts pips to price and back',
    (_symbol, pipSize) => {
      expect(priceToPips(pipsToPrice(37, pipSize), pipSize)).toBeCloseTo(37, 8);
    },
  );
});

describe('lot rounding is always DOWN', () => {
  it('never rounds up into more risk than was asked for', () => {
    // 0.479 → 0.47, not 0.48. Rounding up silently exceeds the stated risk.
    expect(roundLotsDown(0.479)).toBe(0.47);
    expect(roundLotsDown(0.4799999)).toBe(0.47);
  });

  it('honours a coarser broker step', () => {
    expect(roundLotsDown(0.47, 0.1)).toBe(0.4);
    expect(roundLotsDown(1.99, 1)).toBe(1);
  });

  it('returns zero rather than a fraction of a step', () => {
    expect(roundLotsDown(0.004)).toBe(0);
    expect(roundLotsDown(-1)).toBe(0);
  });

  it('does not leak floating-point noise into the displayed size', () => {
    expect(String(roundLotsDown(0.3))).toBe('0.3');
  });
});

describe('risk/reward', () => {
  it('computes a long 3:1 and the win rate it needs', () => {
    // Risk 10, reward 30 → 3:1, breakeven at 10/(10+30) = 25%.
    const outcome = calculateRiskReward({ entry: 2000, stop: 1990, target: 2030 });
    if (!outcome.ok) throw new Error('expected a result');
    expect(outcome.result.direction).toBe('long');
    expect(outcome.result.risk).toBe(10);
    expect(outcome.result.reward).toBe(30);
    expect(outcome.result.ratio).toBe(3);
    expect(outcome.result.breakevenWinRate).toBeCloseTo(0.25, 10);
  });

  it('computes a short with the same arithmetic', () => {
    const outcome = calculateRiskReward({ entry: 2000, stop: 2010, target: 1980 });
    if (!outcome.ok) throw new Error('expected a result');
    expect(outcome.result.direction).toBe('short');
    expect(outcome.result.ratio).toBe(2);
    expect(outcome.result.breakevenWinRate).toBeCloseTo(1 / 3, 10);
  });

  it('puts 1:1 at a 50% breakeven', () => {
    const outcome = calculateRiskReward({ entry: 100, stop: 90, target: 110 });
    if (!outcome.ok) throw new Error('expected a result');
    expect(outcome.result.ratio).toBe(1);
    expect(outcome.result.breakevenWinRate).toBeCloseTo(0.5, 10);
  });

  it('rejects a target on the wrong side of entry', () => {
    // A "long" whose target sits below entry is a typo, not a trade.
    const outcome = calculateRiskReward({ entry: 2000, stop: 1990, target: 1995 });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toBe('direction_mismatch');
  });

  it('rejects a stop at the entry', () => {
    const outcome = calculateRiskReward({ entry: 2000, stop: 2000, target: 2030 });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toBe('stop_equals_entry');
  });

  it.each([
    ['zero', 0],
    ['negative', -10],
    ['NaN', Number.NaN],
  ])('rejects a %s price', (_label, bad) => {
    expect(calculateRiskReward({ entry: bad, stop: 1990, target: 2030 }).ok).toBe(false);
  });

  it('always lands the breakeven rate strictly inside 0 and 1', () => {
    for (const ratio of [0.25, 0.5, 1, 2, 5, 20]) {
      const outcome = calculateRiskReward({ entry: 100, stop: 90, target: 100 + 10 * ratio });
      if (!outcome.ok) throw new Error('expected a result');
      expect(outcome.result.breakevenWinRate).toBeGreaterThan(0);
      expect(outcome.result.breakevenWinRate).toBeLessThan(1);
    }
  });
});

describe('instrument specs', () => {
  it('uses unique ids and positive specs', () => {
    const ids = INSTRUMENTS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of INSTRUMENTS) {
      expect(i.contractSize, i.symbol).toBeGreaterThan(0);
      expect(i.pipSize, i.symbol).toBeGreaterThan(0);
    }
  });
});
