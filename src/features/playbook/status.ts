/**
 * Strategy status transitions (FRS-default; documented, adjustable).
 * draft → active | archived ; active → archived | draft ; archived → active.
 */
import type { StrategyStatus } from './types';

export const STATUS_TRANSITIONS: Record<StrategyStatus, StrategyStatus[]> = {
  draft: ['active', 'archived'],
  active: ['archived', 'draft'],
  archived: ['active'],
};

export function canTransition(from: StrategyStatus, to: StrategyStatus): boolean {
  if (from === to) return true;
  return STATUS_TRANSITIONS[from].includes(to);
}
