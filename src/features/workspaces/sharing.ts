/**
 * Shared-resource rules (Phase 11.0). Sharing is EXPLICIT and PER-RESOURCE —
 * nothing in a workspace is visible by default.
 *
 * PRIVACY BY CONSTRUCTION: only these five resource types can ever be shared.
 * Trades, personal notes, psychology entries, habits, goals, and AI reviews are
 * NOT in this union — and the DB mirrors it with a CHECK constraint — so no
 * role, no bug in a caller, and no crafted request can share personal data
 * through this mechanism. Revocation removes access immediately (reads always
 * check `revoked_at is null`). Shared reports still pass through the 10.7
 * share-safe projection (psychology excluded unless the OWNER opted in).
 */

export const SHAREABLE_TYPES = ['strategy', 'playbook', 'report', 'tag', 'template'] as const;
export type ShareableType = (typeof SHAREABLE_TYPES)[number];

/** Personal data types — structurally unshareable; listed for the test guard. */
export const NEVER_SHAREABLE = [
  'trade',
  'psychology_entry',
  'habit',
  'goal',
  'ai_review',
  'private_note',
  'journal',
] as const;

export function isShareableType(v: unknown): v is ShareableType {
  return typeof v === 'string' && (SHAREABLE_TYPES as readonly string[]).includes(v);
}

export interface ShareRecord {
  resourceType: string;
  revokedAt: string | null;
}

/** A share grants access only while unrevoked and of a shareable type. */
export function isShareActive(share: ShareRecord | null | undefined): boolean {
  if (!share) return false;
  if (!isShareableType(share.resourceType)) return false;
  return share.revokedAt === null;
}
