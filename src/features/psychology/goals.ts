/**
 * Goal progress. `actual` is supplied by the 9.8 engine for trade-derived goals
 * (win rate, RR, profit, drawdown, trading days) so goal numbers reconcile with
 * Analytics — no trade math here. `direction` decides whether higher (`gte`) or
 * lower (`lte`, e.g. max daily loss / drawdown limit) is success.
 */
import { round } from '@/features/analytics/math';
import type { GoalDirection } from './types';

export interface GoalProgress {
  progressPct: number;
  achieved: boolean;
  remaining: number | null;
}

export function computeGoalProgress(
  target: number,
  direction: GoalDirection,
  actual: number,
): GoalProgress {
  const clampPct = (n: number) => Math.max(0, Math.min(100, n));

  if (direction === 'gte') {
    const pct = target <= 0 ? 100 : clampPct((actual / target) * 100);
    return {
      progressPct: round(pct, 0) ?? 0,
      achieved: actual >= target,
      remaining: Math.max(0, round(target - actual, 4) ?? 0),
    };
  }
  // lte: staying at/below the target is success.
  const pct = actual <= target ? 100 : actual <= 0 ? 100 : clampPct((target / actual) * 100);
  return {
    progressPct: round(pct, 0) ?? 0,
    achieved: actual <= target,
    remaining: round(target - actual, 4),
  };
}
