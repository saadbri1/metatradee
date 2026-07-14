/**
 * Habit streaks — WELLBEING-FIRST. Streaks reward showing up (journaling /
 * discipline), never trading volume. A `rest` day is celebrated and never
 * breaks a streak; a missed day can be protected by a freeze token. No shaming:
 * missed days are just counted. Reuses the 9.9 day helpers (addDays/dayDiff).
 */
import { addDays, dayDiff } from '@/features/calendar/time';
import type { HabitLog } from './types';

export interface HabitStreakStats {
  currentStreak: number;
  longestStreak: number;
  completedDays: number;
  restDays: number;
  missedDays: number;
  frozenDays: number;
}

type DayStatus = 'done' | 'rest' | 'missed';

export function computeHabitStreak(
  logs: HabitLog[],
  opts: { freezeTokens?: number } = {},
): HabitStreakStats {
  const empty: HabitStreakStats = {
    currentStreak: 0,
    longestStreak: 0,
    completedDays: 0,
    restDays: 0,
    missedDays: 0,
    frozenDays: 0,
  };
  if (logs.length === 0) return empty;

  const byDate = new Map<string, HabitLog>();
  for (const l of logs) byDate.set(l.log_date, l);
  const dates = [...byDate.keys()].sort();
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;

  // Build a contiguous day range; absent days are 'missed'.
  const span = dayDiff(first, last);
  const statuses: DayStatus[] = [];
  for (let i = 0; i <= span; i++) {
    const key = addDays(first, i);
    const log = byDate.get(key);
    if (!log) statuses.push('missed');
    else if (log.is_rest_day) statuses.push('rest');
    else statuses.push(log.completed ? 'done' : 'missed');
  }

  let tokens = opts.freezeTokens ?? 0;
  let run = 0;
  let longest = 0;
  let completedDays = 0;
  let restDays = 0;
  let missedDays = 0;
  let frozenDays = 0;

  for (const s of statuses) {
    if (s === 'done') {
      completedDays += 1;
      run += 1;
    } else if (s === 'rest') {
      restDays += 1;
      run += 1; // rest never breaks the streak
    } else {
      missedDays += 1;
      if (tokens > 0) {
        tokens -= 1;
        frozenDays += 1;
        run += 1; // freeze protects the streak
      } else {
        run = 0;
      }
    }
    longest = Math.max(longest, run);
  }

  return {
    currentStreak: run,
    longestStreak: longest,
    completedDays,
    restDays,
    missedDays,
    frozenDays,
  };
}
