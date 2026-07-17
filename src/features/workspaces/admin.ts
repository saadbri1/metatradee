/**
 * Organization administration logic (Phase 11.1) — pure, tested.
 *
 * Admin governs the ORGANIZATION, never a member's inner life: nothing here
 * touches personal/psychology data (the 11.0 matrix has no such resource, and
 * these helpers operate only on membership rows).
 *
 * Suspension FAILS CLOSED: a suspended membership resolves to "no membership"
 * everywhere (workspace actions, shares, API tokens), immediately, without
 * deleting any data. Removal revokes org access + authored shares — personal
 * data is never deleted. Ownership transfer is Owner-only, to an existing
 * member; re-auth/MFA enforcement is a live-session concern flagged in the
 * server action.
 */
import { ROLE_RANK, isWorkspaceRole, type WorkspaceRole } from './roles';

export interface MembershipRow {
  workspace_role: string;
  suspended_at: string | null;
}

/** The single suspension rule: suspended (or malformed) = no membership. */
export function effectiveRole(row: MembershipRow | null | undefined): WorkspaceRole | null {
  if (!row || row.suspended_at !== null) return null; // fail closed
  return isWorkspaceRole(row.workspace_role) ? row.workspace_role : null;
}

/** May `actor` suspend/remove `target`? Only strictly-lower ranks; never self. */
export function canModerate(actor: unknown, target: unknown, isSelf: boolean): boolean {
  if (isSelf) return false;
  if (!isWorkspaceRole(actor) || !isWorkspaceRole(target)) return false;
  if (ROLE_RANK[actor] < ROLE_RANK.admin) return false; // admins and owners only
  return ROLE_RANK[target] < ROLE_RANK[actor]; // never peers or above
}

export type TransferVerdict =
  | { ok: true }
  | { ok: false; reason: 'not_owner' | 'target_not_member' | 'target_suspended' | 'self' };

/** Ownership transfer guard: Owner-only, to an active existing member. */
export function validateOwnershipTransfer(
  actorRole: unknown,
  target: MembershipRow | null | undefined,
  isSelf: boolean,
): TransferVerdict {
  if (actorRole !== 'owner') return { ok: false, reason: 'not_owner' };
  if (isSelf) return { ok: false, reason: 'self' };
  if (!target || !isWorkspaceRole(target.workspace_role)) {
    return { ok: false, reason: 'target_not_member' };
  }
  if (target.suspended_at !== null) return { ok: false, reason: 'target_suspended' };
  return { ok: true };
}
