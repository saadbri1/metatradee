import { describe, it, expect } from 'vitest';
import { tzParts, addDays, dayDiff } from '@/features/calendar/time';
import { sessionMembership, primarySession } from '@/features/calendar/sessions';
import { classifyTradeStyle } from '@/features/calendar/duration';
import { buildDailyCalendar } from '@/features/calendar/calendar';
import { bucketByTime } from '@/features/calendar/buckets';
import { buildCalendarSummary } from '@/features/calendar';
import { computeKpis } from '@/features/analytics/kpis';
import type { AnalyticsTrade } from '@/features/analytics/types';

function mk(net: number, closed: string): AnalyticsTrade {
  return {
    id: closed + net,
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
    strategy_id: null,
    broker_id: null,
    trading_account_id: null,
    source: 'manual',
    opened_at: null,
    closed_at: closed,
    duration_seconds: null,
  };
}

describe('timezone bucketing (DST-correct)', () => {
  it('assigns the day in the user tz, not UTC', () => {
    // 02:00Z in winter New York (UTC-5) is the previous day 21:00.
    expect(tzParts('2026-01-01T02:00:00Z', 'America/New_York')?.dateKey).toBe('2025-12-31');
    // UTC bucketing would (wrongly) say 2026-01-01:
    expect(tzParts('2026-01-01T02:00:00Z', 'UTC')?.dateKey).toBe('2026-01-01');
  });
  it('handles DST offset changes (EST vs EDT)', () => {
    // Winter EST = UTC-5: 04:00Z → 23:00 previous day.
    expect(tzParts('2026-01-01T04:00:00Z', 'America/New_York')?.dateKey).toBe('2025-12-31');
    // Summer EDT = UTC-4: 04:00Z → 00:00 same day.
    expect(tzParts('2026-07-01T04:00:00Z', 'America/New_York')?.dateKey).toBe('2026-07-01');
  });
  it('falls back to UTC for an invalid tz', () => {
    expect(tzParts('2026-01-01T10:00:00Z', 'Not/AZone')?.dateKey).toBe('2026-01-01');
  });
});

describe('date key math', () => {
  it('adds days and diffs across a DST boundary safely', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08'); // US DST spring-forward
    expect(dayDiff('2026-03-07', '2026-03-09')).toBe(2);
  });
});

describe('RECONCILIATION — calendar days sum to analytics net', () => {
  it('holds regardless of timezone', () => {
    const trades = [
      mk(100, '2026-01-01T02:00:00Z'),
      mk(-40, '2026-01-01T20:00:00Z'),
      mk(75.5, '2026-01-02T15:00:00Z'),
    ];
    const total = computeKpis(trades).netProfit;
    for (const tz of ['UTC', 'America/New_York', 'Asia/Tokyo']) {
      const days = buildDailyCalendar(trades, tz);
      const summed = Math.round(days.reduce((s, d) => s + d.kpis.netProfit, 0) * 100) / 100;
      expect(summed).toBe(total);
    }
  });
});

describe('sessions', () => {
  it('includes overlap membership for a 13:00Z close', () => {
    const m = sessionMembership('2026-01-01T13:00:00Z');
    expect(m).toContain('london');
    expect(m).toContain('new_york');
    expect(m).toContain('overlap');
  });
  it('prefers the stored session for primary assignment', () => {
    expect(primarySession('2026-01-01T13:00:00Z', 'asian')).toBe('asian');
    expect(primarySession('2026-01-01T13:00:00Z', null)).toBe('london');
  });
});

describe('market-timing classification', () => {
  it('classifies by duration thresholds', () => {
    expect(classifyTradeStyle(600)).toBe('scalping'); // 10m
    expect(classifyTradeStyle(3 * 3600)).toBe('day_trading'); // 3h
    expect(classifyTradeStyle(3 * 86400)).toBe('swing_trading'); // 3d
    expect(classifyTradeStyle(null)).toBe('unknown');
  });
});

describe('time buckets reconcile', () => {
  it('day-of-week nets sum to total', () => {
    const trades = [
      mk(10, '2026-01-01T12:00:00Z'),
      mk(-4, '2026-01-02T12:00:00Z'),
      mk(6, '2026-01-05T12:00:00Z'),
    ];
    const rows = bucketByTime(trades, 'dayOfWeek', 'UTC');
    const summed = rows.reduce((s, r) => s + r.kpis.netProfit, 0);
    expect(summed).toBe(computeKpis(trades).netProfit);
  });
});

describe('summary builds', () => {
  it('exposes reconciling total', () => {
    const trades = [mk(50, '2026-01-01T12:00:00Z'), mk(-20, '2026-01-02T12:00:00Z')];
    const s = buildCalendarSummary(trades, 'UTC');
    expect(s.totalNetProfit).toBe(30);
    expect(s.days).toHaveLength(2);
  });
});
