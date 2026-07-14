import { describe, it, expect } from 'vitest';
import {
  computeDisciplineScore,
  computeEmotionalStability,
  computeHabitConsistency,
} from '@/features/psychology/scores';
import { computeHabitStreak } from '@/features/psychology/streaks';
import { computeGoalProgress } from '@/features/psychology/goals';
import { detectDistress } from '@/features/psychology/wellbeing';
import type { HabitLog } from '@/features/psychology/types';

describe('discipline score (single-sourced formula)', () => {
  it('computes the weighted average of present components', () => {
    // 0.25*80 + 0.20*60 + 0.20*70 + 0.20*90 + 0.15*50 = 71.5 → 72
    const { score } = computeDisciplineScore({
      ruleCompliance: 80,
      goalCompletion: 60,
      habitConsistency: 70,
      executionQuality: 90,
      emotionalStability: 50,
    });
    expect(score).toBe(72);
  });
  it('reweights when components are missing (absent never drags)', () => {
    // only ruleCompliance present → score equals it.
    expect(computeDisciplineScore({ ruleCompliance: 90 }).score).toBe(90);
    expect(computeDisciplineScore({}).score).toBeNull();
  });
});

describe('emotional stability + habit consistency', () => {
  it('prefers self-rated discipline, else inverse stress', () => {
    expect(computeEmotionalStability([{ discipline: 80 }, { stress: 40 }])).toBe(70); // (80 + 60)/2
  });
  it('counts rest days as good for consistency', () => {
    expect(
      computeHabitConsistency([
        { completed: true, is_rest_day: false },
        { completed: false, is_rest_day: true },
        { completed: false, is_rest_day: false },
      ]),
    ).toBe(67); // 2 of 3
  });
});

describe('habit streaks (wellbeing: rest never breaks, freeze protects)', () => {
  function log(d: string, completed: boolean, rest = false): HabitLog {
    return { log_date: d, completed, is_rest_day: rest };
  }

  it('rest days do not break a streak', () => {
    const s = computeHabitStreak([
      log('2026-01-01', true),
      log('2026-01-02', false, true), // rest
      log('2026-01-03', true),
    ]);
    expect(s.currentStreak).toBe(3);
    expect(s.restDays).toBe(1);
    expect(s.missedDays).toBe(0);
  });

  it('a missed day breaks the streak without a freeze token', () => {
    const s = computeHabitStreak([
      log('2026-01-01', true),
      log('2026-01-02', false),
      log('2026-01-03', true),
    ]);
    expect(s.currentStreak).toBe(1);
    expect(s.missedDays).toBe(1);
  });

  it('a freeze token protects one missed day', () => {
    const s = computeHabitStreak(
      [log('2026-01-01', true), log('2026-01-02', false), log('2026-01-03', true)],
      { freezeTokens: 1 },
    );
    expect(s.currentStreak).toBe(3);
    expect(s.frozenDays).toBe(1);
  });

  it('absent days in the range count as missed', () => {
    const s = computeHabitStreak([log('2026-01-01', true), log('2026-01-05', true)]);
    expect(s.missedDays).toBe(3); // Jan 2,3,4
    expect(s.currentStreak).toBe(1);
  });
});

describe('goal progress (reconciles with supplied analytics values)', () => {
  it('handles gte (reach or exceed) goals', () => {
    const p = computeGoalProgress(60, 'gte', 45);
    expect(p.progressPct).toBe(75);
    expect(p.achieved).toBe(false);
    expect(p.remaining).toBe(15);
    expect(computeGoalProgress(60, 'gte', 60).achieved).toBe(true);
  });
  it('handles lte (stay under) goals like max daily loss', () => {
    expect(computeGoalProgress(100, 'lte', 60).achieved).toBe(true);
    const over = computeGoalProgress(100, 'lte', 150);
    expect(over.achieved).toBe(false);
    expect(over.progressPct).toBe(67);
  });
});

describe('wellbeing distress detection (de-escalate, never shame)', () => {
  it('flags escalating losses with a supportive message', () => {
    const r = detectDistress({ recentNets: [-10, -25, -60] });
    expect(r.distressed).toBe(true);
    expect(r.signal).toBe('escalating_losses');
    expect(r.message).not.toMatch(/fail|bad|stupid|loser/i);
  });
  it('flags rapid revenge-logging', () => {
    const r = detectDistress({
      recentEntryTimes: ['2026-01-01T10:00:00Z', '2026-01-01T10:05:00Z', '2026-01-01T10:12:00Z'],
    });
    expect(r.distressed).toBe(true);
    expect(r.signal).toBe('rapid_logging');
  });
  it('stays calm and encouraging when steady', () => {
    const r = detectDistress({ recentNets: [10, -5, 20], recentStress: [30, 40] });
    expect(r.distressed).toBe(false);
  });
});
