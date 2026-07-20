/**
 * Position and P&L accounting (replay trading lifecycle slice).
 *
 * Fixed fills, fixed specs, no randomness. The economic assertions use the
 * exchange-published contract values: a 1-tick (0.25) move is worth $12.50 on
 * ES, $1.25 on MES, $5.00 on NQ, $0.50 on MNQ.
 */
import { describe, it, expect } from 'vitest';
import {
  FLAT_POSITION,
  accountingSnapshot,
  applyFill,
  computePosition,
} from '@/features/simulation/accounting';
import { INSTRUMENT_SPECIFICATIONS, type InstrumentRoot } from '@/features/simulation/instruments';
import type { SimulatedFill } from '@/features/simulation';

const ES = INSTRUMENT_SPECIFICATIONS.ES;

let seq = 0;
function fill(side: 'buy' | 'sell', quantity: number, price: number): SimulatedFill {
  seq += 1;
  return {
    sequence: seq,
    orderId: `o-${seq}`,
    side,
    quantity,
    price,
    candleTime: 1_654_548_600 + seq * 60,
    cursor: seq,
    role: 'entry',
  };
}

describe('long lifecycle', () => {
  it('opens long and closes with realized P&L', () => {
    const fills = [fill('buy', 2, 4100), fill('sell', 2, 4110)];
    const p = computePosition(fills, ES);
    expect(p.side).toBe('flat');
    expect(p.quantity).toBe(0);
    expect(p.averageEntryPrice).toBeNull();
    // 10 points × 2 contracts × $50 = $1,000. Also 40 ticks × $12.50 × 2.
    expect(p.realizedPnl).toBe(1000);
    expect(p.realizedPnl).toBeCloseTo((10 / ES.tickSize) * ES.tickValue * 2, 10);
    expect(p.latestExitPrice).toBe(4110);
    expect(p.contractsTraded).toBe(4);
    expect(p.fillCount).toBe(2);
  });

  it('averages the entry when adding to a long', () => {
    const p = computePosition([fill('buy', 1, 4100), fill('buy', 3, 4108)], ES);
    expect(p.side).toBe('long');
    expect(p.quantity).toBe(4);
    expect(p.averageEntryPrice).toBe(4106); // (4100 + 3×4108) / 4
    expect(p.realizedPnl).toBe(0);
  });

  it('keeps the basis on a partial reduction and realizes only the closed part', () => {
    const p = computePosition([fill('buy', 3, 4100), fill('sell', 1, 4104)], ES);
    expect(p.side).toBe('long');
    expect(p.quantity).toBe(2);
    expect(p.averageEntryPrice).toBe(4100); // reduce never re-averages
    expect(p.realizedPnl).toBe(4 * 1 * 50); // 4 points on one contract
    expect(p.latestExitPrice).toBe(4104);
  });
});

describe('short lifecycle', () => {
  it('opens short and closes with realized P&L', () => {
    const p = computePosition([fill('sell', 2, 4110), fill('buy', 2, 4100)], ES);
    expect(p.side).toBe('flat');
    expect(p.realizedPnl).toBe(1000); // short gains as price falls
  });

  it('loses when a short is covered higher', () => {
    const p = computePosition([fill('sell', 1, 4100), fill('buy', 1, 4105)], ES);
    expect(p.realizedPnl).toBe(-250);
  });
});

describe('reversal', () => {
  it('closes the old position and opens the remainder at the fill price', () => {
    // Long 2 @ 4100, then sell 5 @ 4110: close 2 (+$1000), open short 3 @ 4110.
    const p = computePosition([fill('buy', 2, 4100), fill('sell', 5, 4110)], ES);
    expect(p.side).toBe('short');
    expect(p.quantity).toBe(3);
    expect(p.averageEntryPrice).toBe(4110);
    expect(p.realizedPnl).toBe(1000);
    expect(p.contractsTraded).toBe(7);
  });
});

describe('contract economics', () => {
  const oneTickCases: Array<[InstrumentRoot, number]> = [
    ['ES', 12.5],
    ['MES', 1.25],
    ['NQ', 5],
    ['MNQ', 0.5],
  ];
  it.each(oneTickCases)('%s: one tick on one contract is worth $%s', (root, usd) => {
    const spec = INSTRUMENT_SPECIFICATIONS[root];
    const p = computePosition(
      [fill('buy', 1, 20000), fill('sell', 1, 20000 + spec.tickSize)],
      spec,
    );
    expect(p.realizedPnl).toBeCloseTo(usd, 10);
    // tickValue must equal tickSize × multiplier, or the two formulas diverge.
    expect(spec.tickValue).toBeCloseTo(spec.tickSize * spec.contractMultiplier, 10);
  });
});

describe('unrealized P&L and snapshot', () => {
  it('marks an open long against the latest revealed price', () => {
    const s = accountingSnapshot([fill('buy', 2, 4100)], ES, 4103.5);
    expect(s.unrealizedPnl).toBe(3.5 * 2 * 50);
    expect(s.totalPnl).toBe(s.unrealizedPnl!);
    expect(s.markPrice).toBe(4103.5);
  });

  it('marks an open short in the opposite direction', () => {
    const s = accountingSnapshot([fill('sell', 1, 4100)], ES, 4095);
    expect(s.unrealizedPnl).toBe(250);
  });

  it('reports null unrealized when flat or unmarked — never zero-as-data', () => {
    expect(accountingSnapshot([], ES, 4100).unrealizedPnl).toBeNull();
    expect(accountingSnapshot([fill('buy', 1, 4100)], ES, null).unrealizedPnl).toBeNull();
    const closed = [fill('buy', 1, 4100), fill('sell', 1, 4110)];
    const s = accountingSnapshot(closed, ES, 4200);
    expect(s.unrealizedPnl).toBeNull();
    expect(s.totalPnl).toBe(500); // realized only
  });
});

describe('determinism and purity', () => {
  it('fold equals incremental application at every prefix', () => {
    const fills = [
      fill('buy', 2, 4100),
      fill('buy', 1, 4106),
      fill('sell', 1, 4110),
      fill('sell', 4, 4090),
      fill('buy', 2, 4085),
    ];
    let incremental = FLAT_POSITION;
    for (let i = 0; i < fills.length; i++) {
      incremental = applyFill(incremental, fills[i]!, ES);
      expect(computePosition(fills.slice(0, i + 1), ES)).toEqual(incremental);
    }
  });

  it('never mutates inputs', () => {
    const f = fill('buy', 1, 4100);
    const snapshot = structuredClone(f);
    const before = FLAT_POSITION;
    applyFill(before, f, ES);
    expect(f).toEqual(snapshot);
    expect(before).toEqual(FLAT_POSITION);
  });

  it('empty fill log is exactly the flat position', () => {
    expect(computePosition([], ES)).toEqual(FLAT_POSITION);
  });
});
