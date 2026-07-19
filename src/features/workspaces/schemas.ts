/**
 * Runtime input schemas for workspace Server Actions (Phase 12.1).
 *
 * WHY THESE EXIST: a Server Action is a PUBLIC HTTP endpoint. Its TypeScript
 * parameter types are erased at runtime, so a caller can post any shape at all.
 * The actions already enforce authorization and business rules; these schemas
 * close the remaining gap — they guarantee the *types and bounds* those rules
 * assume before any value reaches a database query.
 *
 * They are deliberately additive: every existing check stays exactly as it was.
 */
import { z } from 'zod';
import { isWorkspaceRole, type WorkspaceRole } from './roles';

/** Database ids are `uuid` (see organizations / organization_members). */
export const uuidSchema = z.string().uuid();

/**
 * Reuses the EXISTING `isWorkspaceRole` guard rather than re-listing the roles,
 * so the role union keeps exactly one source of truth (`roles.ts`).
 */
export const workspaceRoleSchema = z.custom<WorkspaceRole>(isWorkspaceRole, {
  message: 'Unknown workspace role.',
});

export const createWorkspaceSchema = z.string().trim().min(2).max(60);

export const inviteMemberSchema = z.object({
  orgId: uuidSchema,
  // Bounded before the existing format check; RFC-ish max local+domain length.
  email: z.string().trim().toLowerCase().min(3).max(254),
  role: workspaceRoleSchema,
});

export const changeMemberRoleSchema = z.object({
  orgId: uuidSchema,
  memberUserId: uuidSchema,
  role: workspaceRoleSchema,
});

export const createApiTokenSchema = z.object({
  orgId: uuidSchema,
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.string().min(1).max(64)).min(1).max(32),
  expiresInDays: z.number().int().positive().max(365).optional(),
});

export const memberTargetSchema = z.object({
  orgId: uuidSchema,
  memberUserId: uuidSchema,
});
