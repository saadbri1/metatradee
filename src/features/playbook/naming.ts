/**
 * Playbook naming rules — pure, so they are unit-testable and usable on both
 * sides of the server boundary.
 *
 * The database enforces a unique index on (user_id, lower(name)) for live
 * playbooks, so a duplicate must pick a free name up front; otherwise the insert
 * fails with a constraint error the user cannot act on.
 */

/** The `strategies.name` CHECK constraint caps names at 80 characters. */
export const MAX_PLAYBOOK_NAME = 80;

/**
 * "Breakout" → "Breakout (copy)" → "Breakout (copy 2)" → …
 * Copying a copy re-uses the original root rather than nesting suffixes.
 */
export function nextCopyName(base: string, existing: readonly string[]): string {
  const taken = new Set(existing.map((name) => name.trim().toLowerCase()));
  const root = base.replace(/\s*\(copy(?:\s+\d+)?\)$/i, '').trim() || 'Playbook';

  let candidate = `${root} (copy)`;
  let counter = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${root} (copy ${counter})`;
    counter += 1;
  }
  return candidate.length <= MAX_PLAYBOOK_NAME
    ? candidate
    : candidate.slice(0, MAX_PLAYBOOK_NAME).trimEnd();
}

/** Case-insensitive duplicate check for live (non-deleted) playbook names. */
export function isDuplicateName(
  name: string,
  existing: readonly string[],
  ignore?: string,
): boolean {
  const target = name.trim().toLowerCase();
  if (!target) return false;
  return existing.some(
    (candidate) =>
      candidate.trim().toLowerCase() === target &&
      candidate.trim().toLowerCase() !== ignore?.trim().toLowerCase(),
  );
}
