/**
 * Checklist adherence. `approved` = every REQUIRED item checked (a strategy with
 * no required items is approved once at least attempted). Completion % is over
 * all items. Pure + unit-tested.
 */
import { round } from '@/features/analytics/math';
import type { ChecklistItem } from './types';

export interface ChecklistCompletion {
  total: number;
  completed: number;
  requiredTotal: number;
  requiredCompleted: number;
  completedPct: number;
  approved: boolean;
}

export function computeChecklistCompletion(
  items: ChecklistItem[],
  checkedIds: string[],
): ChecklistCompletion {
  const checked = new Set(checkedIds);
  const total = items.length;
  const completed = items.filter((i) => checked.has(i.id)).length;
  const required = items.filter((i) => i.required);
  const requiredCompleted = required.filter((i) => checked.has(i.id)).length;
  const completedPct = total === 0 ? 100 : (round((completed / total) * 100, 1) ?? 0);
  const approved =
    required.length === 0 ? total === 0 || completed > 0 : requiredCompleted === required.length;
  return {
    total,
    completed,
    requiredTotal: required.length,
    requiredCompleted,
    completedPct,
    approved,
  };
}
