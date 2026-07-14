import { describe, it, expect } from 'vitest';
import { computeChecklistCompletion } from '@/features/playbook/checklist';
import { snapshotStrategy, diffSnapshots } from '@/features/playbook/version';
import {
  computeStrategyHealth,
  computeExecutionScore,
  computeAdherenceRate,
} from '@/features/playbook/scores';
import {
  exportTemplate,
  validateTemplate,
  templateToStrategyInput,
} from '@/features/playbook/template';
import { canTransition } from '@/features/playbook/status';
import { computeBreakdown } from '@/features/analytics/breakdowns';
import { computeKpis } from '@/features/analytics/kpis';
import type { Kpis } from '@/features/analytics/types';
import type { StrategyRow, ChecklistItem, AdherenceRecord } from '@/features/playbook/types';
import type { AnalyticsTrade } from '@/features/analytics/types';

const items: ChecklistItem[] = [
  { id: 'a', text: 'HTF bias', required: true },
  { id: 'b', text: 'Killzone', required: true },
  { id: 'c', text: 'Optional note', required: false },
];

describe('checklist completion + approval', () => {
  it('approves only when all required items are checked', () => {
    const partial = computeChecklistCompletion(items, ['a', 'c']);
    expect(partial.approved).toBe(false);
    expect(partial.requiredCompleted).toBe(1);
    const full = computeChecklistCompletion(items, ['a', 'b']);
    expect(full.approved).toBe(true);
    expect(full.completedPct).toBeCloseTo(66.7, 0);
  });
  it('empty checklist is complete', () => {
    expect(computeChecklistCompletion([], []).completedPct).toBe(100);
  });
});

describe('version snapshot + diff', () => {
  const base = {
    name: 'A',
    status: 'active',
    entry_rules: [{ id: 'e1', text: 'sweep' }],
    checklist: [],
  } as Partial<StrategyRow>;

  it('detects changed fields only', () => {
    const a = snapshotStrategy(base);
    const b = snapshotStrategy({
      ...base,
      name: 'B',
      entry_rules: [{ id: 'e1', text: 'displace' }],
    });
    const diff = diffSnapshots(a, b);
    const fields = diff.map((d) => d.field);
    expect(fields).toContain('name');
    expect(fields).toContain('entry_rules');
    expect(fields).not.toContain('status');
  });
  it('identical snapshots diff to nothing', () => {
    expect(diffSnapshots(snapshotStrategy(base), snapshotStrategy(base))).toHaveLength(0);
  });
});

describe('composite scores (single formula source)', () => {
  it('computes health from a known KPI shape', () => {
    const kpis = { totalTrades: 10, winRate: 0.5, profitFactor: 3, grossProfit: 100 } as Kpis;
    // 0.4*50 + 0.4*100 + 0.2*50 = 70
    expect(computeStrategyHealth(kpis)).toBe(70);
  });
  it('returns null with no trades', () => {
    expect(computeStrategyHealth({ totalTrades: 0 } as Kpis)).toBeNull();
  });
  it('computes execution + adherence from records', () => {
    const recs = [
      { execution_quality: 80, followed_strategy: true },
      { execution_quality: 60, followed_strategy: false },
    ] as AdherenceRecord[];
    expect(computeExecutionScore(recs)).toBe(70);
    expect(computeAdherenceRate(recs)).toBe(50);
  });
});

describe('templates (marketplace-ready, sanitized)', () => {
  const strategy = {
    id: 's1',
    user_id: 'u1',
    name: 'My SMC',
    entry_rules: [{ id: 'e1', text: 'sweep', required: true }],
    exit_rules: [],
    stop_loss_rules: [],
    take_profit_rules: [],
    position_sizing_rules: [],
    risk_rules: [],
    confirmation_rules: [],
    invalidation_rules: [],
    checklist: [],
    symbols: [],
    timeframes: [],
    sessions: [],
    category: 'SMC',
  } as unknown as StrategyRow;

  it('exports without ids/PII and re-imports as a valid strategy input', () => {
    const tpl = exportTemplate(strategy, 'author');
    expect(JSON.stringify(tpl)).not.toContain('u1');
    expect(JSON.stringify(tpl)).not.toContain('"s1"');
    const check = validateTemplate(tpl);
    expect(check.ok).toBe(true);
    if (check.ok) {
      const input = templateToStrategyInput(check.data.content, 'From template');
      expect(input.name).toBe('From template');
      expect(input.entry_rules[0]?.text).toBe('sweep');
    }
  });
  it('rejects malformed and future-schema templates', () => {
    expect(validateTemplate({ nope: true }).ok).toBe(false);
    expect(validateTemplate({ name: 'x', schema_version: 99, content: {} }).ok).toBe(false);
  });
});

describe('status transitions', () => {
  it('enforces the allowed transitions', () => {
    expect(canTransition('draft', 'active')).toBe(true);
    expect(canTransition('archived', 'draft')).toBe(false);
    expect(canTransition('active', 'archived')).toBe(true);
  });
});

describe('RECONCILIATION — strategy performance == analytics strategy breakdown', () => {
  function t(net: number, strategy_id: string | null): AnalyticsTrade {
    return {
      id: Math.random().toString(36).slice(2),
      net_pnl: net,
      pnl: net,
      rr_ratio: null,
      quantity: 1,
      position_size: 1,
      risk_amount: null,
      risk_percent: null,
      direction: 'buy',
      symbol: 'X',
      market: null,
      asset_type: null,
      session: null,
      strategy_id,
      broker_id: null,
      trading_account_id: null,
      source: 'manual',
      opened_at: null,
      closed_at: '2026-01-01T00:00:00Z',
      duration_seconds: null,
    };
  }
  it('matches the same numbers for a strategy', () => {
    const trades = [t(100, 's1'), t(-40, 's1'), t(60, 's2')];
    const breakdown = computeBreakdown(trades, 'strategy');
    const s1FromBreakdown = breakdown.find((r) => r.key === 's1')?.kpis.netProfit;
    const s1Direct = computeKpis(trades.filter((x) => x.strategy_id === 's1')).netProfit;
    expect(s1FromBreakdown).toBe(s1Direct);
    expect(s1Direct).toBe(60);
  });
});
