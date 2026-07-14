/**
 * Version snapshots + diffing. A snapshot is the versionable content of a
 * strategy; snapshots are immutable (append-only in the DB). Diffing compares
 * two snapshots field-by-field (rule groups + checklist compared structurally).
 */
import { RULE_GROUPS } from './types';
import type { StrategyRow } from './types';

const SCALAR_FIELDS = [
  'name',
  'description',
  'category',
  'market',
  'asset_class',
  'notes',
  'status',
] as const;
const ARRAY_FIELDS = ['symbols', 'timeframes', 'sessions'] as const;

export type Snapshot = Record<string, unknown>;

/** Build the versioned content for a strategy (only the fields we version). */
export function snapshotStrategy(s: Partial<StrategyRow>): Snapshot {
  const snap: Snapshot = {};
  for (const f of SCALAR_FIELDS) snap[f] = s[f] ?? null;
  for (const f of ARRAY_FIELDS) snap[f] = s[f] ?? [];
  for (const g of RULE_GROUPS) snap[g] = s[g] ?? [];
  snap.checklist = s.checklist ?? [];
  return snap;
}

export interface VersionDiff {
  field: string;
  from: unknown;
  to: unknown;
}

function eq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Ordered list of fields that changed between two snapshots. */
export function diffSnapshots(a: Snapshot, b: Snapshot): VersionDiff[] {
  const fields = [...SCALAR_FIELDS, ...ARRAY_FIELDS, ...RULE_GROUPS, 'checklist'] as const;
  const diffs: VersionDiff[] = [];
  for (const f of fields) {
    if (!eq(a[f], b[f])) diffs.push({ field: f, from: a[f] ?? null, to: b[f] ?? null });
  }
  return diffs;
}
