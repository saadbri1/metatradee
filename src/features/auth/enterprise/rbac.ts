/**
 * Enterprise RBAC (Phase 9.2 enterprise additions).
 *
 * Roles live in the user's `app_metadata` — set by admins/service only, so the
 * client cannot tamper with them (unlike `user_metadata`). This module is the
 * pure resolver that fills the existing `resolveEntitlements` seam; the
 * `organization_members` table is the management system-of-record that keeps
 * `app_metadata.role` in sync.
 *
 * FAIL CLOSED: an unknown/absent/invalid role resolves to the least-privileged
 * `member` with no permissions. Permission checks default to denied.
 */
import type { Entitlements, Role } from '../types';

export const ROLES: readonly Role[] = ['member', 'admin', 'owner'] as const;

/** Ordering for "at least this role" checks. */
export const ROLE_RANK: Record<Role, number> = { member: 0, admin: 1, owner: 2 };

/** Permission slugs granted per role (cumulative by rank). */
export const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  member: ['journal:read', 'journal:write', 'reports:read'],
  admin: ['members:read', 'members:invite', 'billing:read', 'reports:manage'],
  owner: ['members:manage', 'billing:manage', 'org:manage', 'sso:manage'],
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** All permissions a role holds, accumulating lower-ranked roles' permissions. */
export function permissionsForRole(role: Role): string[] {
  const out = new Set<string>();
  for (const r of ROLES) {
    if (ROLE_RANK[r] <= ROLE_RANK[role]) {
      for (const p of ROLE_PERMISSIONS[r]) out.add(p);
    }
  }
  return [...out];
}

/**
 * Resolve entitlements from a user's app_metadata (tamper-proof). Fails closed
 * to `member` when the role is missing/invalid.
 */
export function resolveEntitlementsFromMetadata(
  appMetadata: Record<string, unknown> | null | undefined,
): Entitlements {
  const rawRole = appMetadata?.role;
  const role: Role = isRole(rawRole) ? rawRole : 'member';
  const organizationId =
    typeof appMetadata?.organization_id === 'string' ? appMetadata.organization_id : null;
  return { role, permissions: permissionsForRole(role), organizationId };
}

/** Permission check — default denied. */
export function hasPermission(entitlements: Entitlements, slug: string): boolean {
  return entitlements.permissions.includes(slug);
}

/** "At least this role" check. */
export function hasRole(entitlements: Entitlements, minimum: Role): boolean {
  return ROLE_RANK[entitlements.role] >= ROLE_RANK[minimum];
}
