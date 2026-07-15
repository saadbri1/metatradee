import { describe, it, expect } from 'vitest';
import { computeKpis } from '@/features/analytics';
import { buildKpiCards, currentStreak } from '@/features/dashboard/kpi';
import { buildChecklist, checklistProgress } from '@/features/dashboard/checklist';
import { activityLabel, toActivityItems } from '@/features/dashboard/activity';
import { trade } from '../ai-coach/fixtures';

describe('dashboard KPIs reconcile with the analytics engine (no duplicate math)', () => {
  it('KPI card values are the engine outputs, not re-derived', () => {
    const trades = [trade({ net_pnl: 100 }), trade({ net_pnl: -40 }), trade({ net_pnl: 60 })];
    const kpis = computeKpis(trades);
    const cards = buildKpiCards(kpis, currentStreak(trades.map((t) => t.net_pnl)));
    const net = cards.find((c) => c.id === 'net-pnl');
    expect(net?.value).toBe('120'); // == kpis.netProfit (100-40+60)
    expect(kpis.netProfit).toBe(120);
    expect(cards.find((c) => c.id === 'total-trades')?.value).toBe('3');
  });

  it('renders honest zeros/dashes on an empty trade set (no fabricated stats)', () => {
    const kpis = computeKpis([]);
    const cards = buildKpiCards(kpis, currentStreak([]));
    expect(cards.find((c) => c.id === 'total-trades')?.value).toBe('0');
    expect(cards.find((c) => c.id === 'net-pnl')?.value).toBe('0');
    expect(cards.find((c) => c.id === 'win-rate')?.value).toBe('—');
    expect(cards.find((c) => c.id === 'current-streak')?.value).toBe('—');
    // No card ever shows a random/invented number.
    for (const c of cards) expect(c.value).not.toMatch(/NaN|undefined|null/);
  });

  it('every card carries a screen-reader label + a profit/loss tone', () => {
    const cards = buildKpiCards(computeKpis([trade({ net_pnl: 50 })]), { count: 1, kind: 'win' });
    for (const c of cards) {
      expect(c.srLabel.length).toBeGreaterThan(0);
      expect([-1, 0, 1]).toContain(c.tone);
    }
    expect(cards.find((c) => c.id === 'net-pnl')?.tone).toBe(1); // profit
  });
});

describe('current streak (display derivation over net_pnl)', () => {
  it('counts the trailing run of same-sign results', () => {
    expect(currentStreak([10, -5, 20, 30])).toEqual({ count: 2, kind: 'win' });
    expect(currentStreak([10, -5, -20])).toEqual({ count: 2, kind: 'loss' });
    expect(currentStreak([])).toEqual({ count: 0, kind: 'none' });
    // break-even (0) and null are ignored, not counted as a streak.
    expect(currentStreak([10, 0, null])).toEqual({ count: 1, kind: 'win' });
  });
});

describe('setup checklist derives from real state (never hardcoded)', () => {
  it('marks items done from counts + profile', () => {
    const items = buildChecklist({
      profileComplete: true,
      onboardingComplete: true,
      accountCount: 1,
      strategyCount: 0,
      tradeCount: 0,
    });
    expect(items.find((i) => i.id === 'profile')?.done).toBe(true);
    expect(items.find((i) => i.id === 'account')?.done).toBe(true);
    expect(items.find((i) => i.id === 'strategy')?.done).toBe(false);
    expect(checklistProgress(items)).toBe(50); // 3 of 6
  });

  it('is empty-safe (all false → 0%)', () => {
    const items = buildChecklist({
      profileComplete: false,
      onboardingComplete: false,
      accountCount: 0,
      strategyCount: 0,
      tradeCount: 0,
    });
    expect(checklistProgress(items)).toBe(0);
  });
});

describe('recent activity reuses the audit trail (no second logging system)', () => {
  it('maps known audit events to friendly labels', () => {
    expect(activityLabel('profile.updated')).toBe('Profile updated');
    expect(activityLabel('trade.created')).toBe('Logged a trade');
    expect(activityLabel('mfa.enrolled')).toBe('Enabled two-factor authentication');
  });

  it('falls back safely for unmapped events (never drops or fakes)', () => {
    expect(activityLabel('report.share.created')).toBe('Share created');
    expect(activityLabel('')).toBe('Activity');
  });

  it('converts audit rows to activity items preserving timestamps', () => {
    const items = toActivityItems([
      { event_type: 'profile.updated', created_at: '2026-01-01T00:00:00Z' },
    ]);
    expect(items).toEqual([{ label: 'Profile updated', at: '2026-01-01T00:00:00Z' }]);
  });
});
