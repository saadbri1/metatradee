/**
 * Deterministic duplicate detection. The canonical dedupe key is
 * account + symbol + direction + time + size + entry price; a "partial" key
 * drops size/price so near-duplicates (same trade, different fill detail) are
 * flagged rather than silently merged. Pure + unit-tested; reused by the import
 * engine (9.7) so both paths share ONE definition.
 */
export interface DedupeInput {
  trading_account_id?: string | null;
  symbol: string;
  direction: string;
  /** Prefer executed_at, else opened_at. */
  time?: string | null;
  quantity?: number | null;
  entry_price?: number | null;
}

function norm(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v).trim().toLowerCase();
}

/** 64-bit-ish FNV-1a as 16 hex chars (two 32-bit passes) — stable + dependency-free. */
function fnv1a(str: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x01000193);
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return hex(h1) + hex(h2);
}

/** Full-duplicate content hash (account+symbol+direction+time+size+entry). */
export function tradeContentHash(input: DedupeInput): string {
  const key = [
    norm(input.trading_account_id),
    norm(input.symbol),
    norm(input.direction),
    norm(input.time),
    norm(input.quantity),
    norm(input.entry_price),
  ].join('|');
  return fnv1a(key);
}

/** Partial-duplicate key (account+symbol+direction+time) — ignores size/price. */
export function tradePartialKey(input: DedupeInput): string {
  const key = [
    norm(input.trading_account_id),
    norm(input.symbol),
    norm(input.direction),
    norm(input.time),
  ].join('|');
  return fnv1a(key);
}

export type DuplicateVerdict = 'full' | 'partial' | 'none';

/**
 * Classify a candidate against existing trades' hashes. `full` when the content
 * hash matches; `partial` when only the partial key matches; else `none`.
 */
export function classifyDuplicate(
  candidate: DedupeInput,
  existing: { content_hash: string; partial_key: string }[],
): DuplicateVerdict {
  const full = tradeContentHash(candidate);
  const partial = tradePartialKey(candidate);
  if (existing.some((e) => e.content_hash === full)) return 'full';
  if (existing.some((e) => e.partial_key === partial)) return 'partial';
  return 'none';
}
