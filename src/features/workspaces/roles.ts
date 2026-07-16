/**
 * Workspace roles & permission matrix (Phase 11.0).
 *
 * DESIGN DECISION (user-approved): the six workspace roles map onto the LOCKED
 * 9.2 three-role DB model (`organization_members.role ∈ member/admin/owner`),
 * which stays byte-for-byte untouched. The six-role label is stored additively
 * in `workspace_role`; the DB rank stays authoritative for is_admin()/RLS.
 *
 * PRIVACY BY CONSTRUCTION: the matrix has NO psychology/journal/AI-review
 * resource at all — no role, including Owner, can be granted access to another
 * member's personal data through this system. `can()` FAILS CLOSED: unknown
 * role, resource, or action → false.
 */
import type { Role } from '@/features/auth/types';

export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'coach' | 'trader' | 'viewer';

/** Resources a workspace can govern. Personal data types are deliberately absent. */
export type WorkspaceResource =
  | 'workspace' // settings, delete, transfer
  | 'members' // invite, change roles, remove
  | 'billing'
  | 'strategies' // shared strategies
  | 'playbooks'
  | 'reports' // shared reports (share-safe projection rules still apply)
  | 'tags'
  | 'templates';

export type WorkspaceAction = 'view' | 'create' | 'edit' | 'delete' | 'share' | 'manage';

/** Map each workspace role onto the locked 9.2 DB role (authority rank). */
export const DB_ROLE_FOR: Record<WorkspaceRole, Role> = {
  owner: 'owner',
  admin: 'admin',
  manager: 'member',
  coach: 'member',
  trader: 'member',
  viewer: 'member',
};

/** Authority rank for escalation checks (an actor can never grant above self). */
export const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 5,
  admin: 4,
  manager: 3,
  coach: 2,
  trader: 1,
  viewer: 0,
};

type Grant = `${WorkspaceResource}:${WorkspaceAction}`;

const VIEWER: readonly Grant[] = [
  'strategies:view',
  'playbooks:view',
  'reports:view',
  'tags:view',
  'templates:view',
];
const TRADER: readonly Grant[] = [...VIEWER, 'strategies:share', 'reports:share', 'tags:create'];
const COACH: readonly Grant[] = [
  ...TRADER,
  'strategies:create',
  'playbooks:create',
  'templates:create',
  'playbooks:share',
  'templates:share',
];
const MANAGER: readonly Grant[] = [
  ...COACH,
  'strategies:edit',
  'playbooks:edit',
  'templates:edit',
  'tags:edit',
  'members:view' as Grant,
];
const ADMIN: readonly Grant[] = [
  ...MANAGER,
  'members:manage',
  'billing:view',
  'strategies:delete',
  'playbooks:delete',
  'templates:delete',
  'tags:delete',
  'reports:manage',
  'workspace:edit',
];
const OWNER: readonly Grant[] = [
  ...ADMIN,
  'billing:manage',
  'workspace:manage',
  'workspace:delete',
];

/** The full role × resource × action matrix (explicit, testable, one source). */
export const PERMISSION_MATRIX: Record<WorkspaceRole, readonly Grant[]> = {
  owner: OWNER,
  admin: ADMIN,
  manager: MANAGER,
  coach: COACH,
  trader: TRADER,
  viewer: VIEWER,
};

export function isWorkspaceRole(v: unknown): v is WorkspaceRole {
  return (
    typeof v === 'string' && ['owner', 'admin', 'manager', 'coach', 'trader', 'viewer'].includes(v)
  );
}

/** Permission check — FAILS CLOSED on any unknown input. */
export function can(role: unknown, resource: WorkspaceResource, action: WorkspaceAction): boolean {
  if (!isWorkspaceRole(role)) return false;
  return PERMISSION_MATRIX[role].includes(`${resource}:${action}` as Grant);
}

/** May `actor` assign `target` role? Never above the actor's own rank. */
export function canAssignRole(actor: unknown, target: unknown): boolean {
  if (!isWorkspaceRole(actor) || !isWorkspaceRole(target)) return false;
  if (!can(actor, 'members', 'manage')) return false;
  return ROLE_RANK[target] < ROLE_RANK[actor] || (actor === 'owner' && target === 'owner');
}
