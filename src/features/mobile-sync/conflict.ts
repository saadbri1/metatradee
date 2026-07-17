/**
 * Conflict resolution (Phase 11.3) — explicit, never silent. The engine NEVER
 * picks a winner or discards data; a conflict is surfaced and the user's choice
 * is applied here. See docs/SYNC_AND_CONFLICT_DESIGN.md §3.
 */
import type { ConflictResolution } from './types';

/** A conflict presented to the user: their local change vs the current server row. */
export interface ConflictView {
  targetId: string;
  local: Record<string, unknown>;
  server: Record<string, unknown>;
  /** Fields that actually differ (for a focused, non-overwhelming prompt). */
  changedFields: string[];
}

/** Compute the differing fields between local and server versions. */
export function diffFields(
  local: Record<string, unknown>,
  server: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(local), ...Object.keys(server)]);
  const changed: string[] = [];
  for (const k of keys) {
    if (JSON.stringify(local[k]) !== JSON.stringify(server[k])) changed.push(k);
  }
  return changed.sort();
}

export function buildConflictView(
  targetId: string,
  local: Record<string, unknown>,
  server: Record<string, unknown>,
): ConflictView {
  return { targetId, local, server, changedFields: diffFields(local, server) };
}

/**
 * Apply the user's decision. `keep_local` → their version; `keep_server` →
 * abandon the local change (kept for audit, never destroyed silently); `merge`
 * → field-level selection. No data is lost without an explicit user choice.
 */
export function applyResolution(
  view: ConflictView,
  resolution: ConflictResolution,
  fieldChoices: Record<string, 'local' | 'server'> = {},
): Record<string, unknown> {
  if (resolution === 'keep_local') return { ...view.server, ...view.local };
  if (resolution === 'keep_server') return { ...view.server };
  // merge: start from server, apply per-field the user's choice; default server.
  const merged: Record<string, unknown> = { ...view.server };
  for (const field of view.changedFields) {
    if (fieldChoices[field] === 'local') merged[field] = view.local[field];
  }
  return merged;
}
