/**
 * Discipline score — the SINGLE source of this composite formula (FRS-default,
 * documented, adjustable). Framed constructively (a target to improve, never
 * punitive). Inputs are 0–100 and reuse 9.10 adherence/execution, habit
 * consistency, goal completion, and psychology data — no metric is recomputed.
 *
 *   discipline = weighted avg of PRESENT components (missing are reweighted out,
 *   so absent data never drags the score down):
 *     ruleCompliance 0.25 · goalCompletion 0.20 · habitConsistency 0.20 ·
 *     executionQuality 0.20 · emotionalStability 0.15
 */
import { mean, round } from '@/features/analytics/math';

export interface DisciplineComponents {
  ruleCompliance?: number | null;
  goalCompletion?: number | null;
  habitConsistency?: number | null;
  executionQuality?: number | null;
  emotionalStability?: number | null;
}

const WEIGHTS: Record<keyof DisciplineComponents, number> = {
  ruleCompliance: 0.25,
  goalCompletion: 0.2,
  habitConsistency: 0.2,
  executionQuality: 0.2,
  emotionalStability: 0.15,
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function computeDisciplineScore(c: DisciplineComponents): {
  score: number | null;
  components: DisciplineComponents;
} {
  let sum = 0;
  let wsum = 0;
  (Object.keys(WEIGHTS) as (keyof DisciplineComponents)[]).forEach((k) => {
    const v = c[k];
    if (v !== null && v !== undefined && Number.isFinite(v)) {
      sum += clamp(v) * WEIGHTS[k];
      wsum += WEIGHTS[k];
    }
  });
  if (wsum === 0) return { score: null, components: c };
  return { score: round(clamp(sum / wsum), 0), components: c };
}

/** Emotional stability from psychology entries: prefer self-rated discipline,
 *  else the inverse of stress. 0–100 (higher = steadier). */
export function computeEmotionalStability(
  entries: { stress?: number | null; discipline?: number | null }[],
): number | null {
  const vals = entries
    .map((e) =>
      e.discipline !== null && e.discipline !== undefined
        ? e.discipline
        : e.stress !== null && e.stress !== undefined
          ? 100 - e.stress
          : null,
    )
    .filter((v): v is number => v !== null);
  return vals.length ? round(mean(vals), 0) : null;
}

/** Habit consistency = completed (incl. rest) days / tracked days, as a %. */
export function computeHabitConsistency(
  logs: { completed: boolean; is_rest_day: boolean }[],
): number | null {
  if (logs.length === 0) return null;
  const good = logs.filter((l) => l.completed || l.is_rest_day).length;
  return round((good / logs.length) * 100, 0);
}

/** Goal completion = achieved goals / total, as a %. */
export function computeGoalCompletion(goals: { status: string }[]): number | null {
  if (goals.length === 0) return null;
  const done = goals.filter((g) => g.status === 'completed').length;
  return round((done / goals.length) * 100, 0);
}
