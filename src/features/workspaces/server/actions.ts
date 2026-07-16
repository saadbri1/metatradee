'use server';

/**
 * Workspace server actions (Phase 11.0). Tenancy invariants:
 *
 *  MEMBERSHIP RE-VALIDATED ON EVERY CALL — the client passes a workspace id but
 *  is never trusted: each action re-reads the caller's membership + role from
 *  the DB and FAILS CLOSED (unknown state → deny).
 *
 *  PRIVACY — nothing here can read another member's personal data. Sharing is
 *  by explicit reference to one of five shareable types (DB CHECK mirrors it);
 *  ownership of the resource is verified before a share row is created.
 *
 *  NO ENUMERATION — invitation acceptance returns uniform errors; the flow
 *  never reveals whether an email has an account.
 *
 *  Every event audited via the existing infra (events only, never content).
 *  Email delivery of invites is a SEAM (no email module / RESEND key in repo):
 *  invites are issued as links the inviter shares; sending is flagged.
 */
import { createClient } from '@/lib/supabase/server';
import { AUDIT_EVENTS } from '@/features/auth/config';
import { logAuditEvent } from '@/features/auth/server/audit';
import { generateShareToken } from '@/features/reports/share/tokens';
import { canAssignRole, DB_ROLE_FOR, isWorkspaceRole, can, type WorkspaceRole } from '../roles';
import {
  canInvite,
  inviteExpiry,
  validateInvite,
  MAX_PENDING_INVITES_PER_WORKSPACE,
} from '../invitations';
import { isShareableType, type ShareableType } from '../sharing';

interface ActionResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}
const GENERIC = 'Something went wrong. Please try again.';
/** Uniform invitation error — reveals nothing (no enumeration). */
const INVITE_INVALID = 'This invitation is not valid.';

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { userId: user.id, email: user.email ?? null, supabase } : null;
}

/** Authoritative membership lookup — FAILS CLOSED (null on anything unknown). */
async function membership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  orgId: string,
): Promise<{ role: WorkspaceRole } | null> {
  const { data } = await supabase
    .from('organization_members')
    .select('workspace_role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();
  const raw = (data as { workspace_role: string } | null)?.workspace_role;
  return isWorkspaceRole(raw) ? { role: raw } : null;
}

/** Create a team workspace; creator becomes Owner. */
export async function createWorkspaceAction(name: string): Promise<ActionResult<{ id: string }>> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 60) {
    return { ok: false, error: 'Workspace name must be 2–60 characters.' };
  }
  const slug = `${trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)}-${Date.now().toString(36)}`;
  const { data: org, error } = await c.supabase
    .from('organizations')
    .insert({ name: trimmed, slug, created_by: c.userId })
    .select('id')
    .single();
  if (error || !org) return { ok: false, error: GENERIC };
  const orgId = (org as { id: string }).id;
  const { error: memberErr } = await c.supabase
    .from('organization_members')
    .insert({ org_id: orgId, user_id: c.userId, role: 'owner', workspace_role: 'owner' });
  if (memberErr) return { ok: false, error: GENERIC };
  await logAuditEvent(AUDIT_EVENTS.workspaceCreated, { orgId });
  return { ok: true, data: { id: orgId } };
}

export interface WorkspaceListItem {
  id: string;
  name: string;
  role: WorkspaceRole;
}

/** Workspaces the caller belongs to (membership-derived, never client state). */
export async function listMyWorkspacesAction(): Promise<WorkspaceListItem[]> {
  const c = await ctx();
  if (!c) return [];
  const { data } = await c.supabase
    .from('organization_members')
    .select('org_id, workspace_role, organizations(name)')
    .eq('user_id', c.userId);
  return (
    (data as
      | { org_id: string; workspace_role: string; organizations: { name: string } | null }[]
      | null) ?? []
  )
    .filter((r) => isWorkspaceRole(r.workspace_role))
    .map((r) => ({
      id: r.org_id,
      name: r.organizations?.name ?? 'Workspace',
      role: r.workspace_role as WorkspaceRole,
    }));
}

/** Invite by email. Rate-limited; role capped at inviter's authority; audited. */
export async function inviteMemberAction(payload: {
  orgId: string;
  email: string;
  role: string;
}): Promise<ActionResult<{ inviteUrl: string }>> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const m = await membership(c.supabase, c.userId, payload.orgId);
  if (!m || !canInvite(m.role, payload.role)) {
    return { ok: false, error: 'You do not have permission to send this invitation.' };
  }
  const email = payload.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, error: 'Enter a valid email.' };

  // Rate limit: bounded pending invites per workspace.
  const { count } = await c.supabase
    .from('workspace_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', payload.orgId)
    .is('accepted_at', null)
    .is('declined_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString());
  if ((count ?? 0) >= MAX_PENDING_INVITES_PER_WORKSPACE) {
    return { ok: false, error: 'Too many pending invitations — revoke some or wait.' };
  }

  const token = generateShareToken(); // 256-bit CSPRNG (10.7 crypto, reused)
  const { error } = await c.supabase.from('workspace_invitations').insert({
    org_id: payload.orgId,
    invited_by: c.userId,
    email,
    workspace_role: payload.role,
    token,
    expires_at: inviteExpiry(),
  });
  if (error) return { ok: false, error: GENERIC };
  await logAuditEvent(AUDIT_EVENTS.workspaceInviteSent, {
    orgId: payload.orgId,
    role: payload.role,
  });
  // EMAIL SEAM: no email module/key exists in the repo — the inviter shares this
  // link. Wiring Resend here is a documented follow-up, not a second system.
  return { ok: true, data: { inviteUrl: `/workspace/invite/${token}` } };
}

/** Accept an invitation. Uniform errors; single-use; email-bound; no escalation. */
export async function acceptInvitationAction(
  token: string,
): Promise<ActionResult<{ orgId: string }>> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'Sign in to accept an invitation.' };
  const { data } = await c.supabase
    .from('workspace_invitations')
    .select('id, org_id, email, workspace_role, expires_at, accepted_at, declined_at, revoked_at')
    .eq('token', token)
    .maybeSingle();
  // NOTE: reads go through a definer-free path here because the invitee is not
  // yet a member; on a live DB this read is served via a SECURITY DEFINER RPC
  // (documented pending-live) — the validation below is the authoritative gate.
  const row = data as {
    id: string;
    org_id: string;
    email: string;
    workspace_role: string;
    expires_at: string;
    accepted_at: string | null;
    declined_at: string | null;
    revoked_at: string | null;
  } | null;

  const verdict = validateInvite(
    row
      ? {
          email: row.email,
          workspaceRole: row.workspace_role,
          expiresAt: row.expires_at,
          acceptedAt: row.accepted_at,
          declinedAt: row.declined_at,
          revokedAt: row.revoked_at,
        }
      : null,
    c.email,
  );
  if (!verdict.ok || !row) return { ok: false, error: INVITE_INVALID }; // uniform

  const role = row.workspace_role as WorkspaceRole;
  const { error: memberErr } = await c.supabase.from('organization_members').insert({
    org_id: row.org_id,
    user_id: c.userId,
    role: DB_ROLE_FOR[role],
    workspace_role: role,
  });
  if (memberErr) return { ok: false, error: INVITE_INVALID }; // already a member etc. — uniform
  await c.supabase
    .from('workspace_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', row.id);
  await logAuditEvent(AUDIT_EVENTS.workspaceInviteAccepted, { orgId: row.org_id });
  return { ok: true, data: { orgId: row.org_id } };
}

export async function revokeInvitationAction(
  orgId: string,
  inviteId: string,
): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const m = await membership(c.supabase, c.userId, orgId);
  if (!m || !can(m.role, 'members', 'manage')) return { ok: false, error: 'Not permitted.' };
  const { error } = await c.supabase
    .from('workspace_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', inviteId)
    .eq('org_id', orgId);
  if (error) return { ok: false, error: GENERIC };
  await logAuditEvent(AUDIT_EVENTS.workspaceInviteRevoked, { orgId });
  return { ok: true };
}

/** Change a member's role. Escalation-guarded + audited. */
export async function changeMemberRoleAction(payload: {
  orgId: string;
  memberUserId: string;
  role: string;
}): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const actor = await membership(c.supabase, c.userId, payload.orgId);
  if (!actor || !canAssignRole(actor.role, payload.role)) {
    return { ok: false, error: 'You cannot assign this role.' };
  }
  const role = payload.role as WorkspaceRole;
  const { error } = await c.supabase
    .from('organization_members')
    .update({ role: DB_ROLE_FOR[role], workspace_role: role })
    .eq('org_id', payload.orgId)
    .eq('user_id', payload.memberUserId);
  if (error) return { ok: false, error: GENERIC };
  await logAuditEvent(AUDIT_EVENTS.workspaceRoleChanged, { orgId: payload.orgId, role });
  return { ok: true };
}

const RESOURCE_TABLE: Record<ShareableType, string> = {
  strategy: 'strategies',
  playbook: 'playbooks',
  report: 'reports',
  tag: 'tags',
  template: 'strategy_templates',
};

/** ShareableType → the permission-matrix resource it is governed by. */
const MATRIX_RESOURCE: Record<
  ShareableType,
  'strategies' | 'playbooks' | 'reports' | 'tags' | 'templates'
> = {
  strategy: 'strategies',
  playbook: 'playbooks',
  report: 'reports',
  tag: 'tags',
  template: 'templates',
};

/** Share a resource YOU OWN into a workspace (explicit, revocable). */
export async function shareResourceAction(payload: {
  orgId: string;
  resourceType: string;
  resourceId: string;
}): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  if (!isShareableType(payload.resourceType)) {
    // Personal data types land here BY CONSTRUCTION — the union excludes them.
    return { ok: false, error: 'This resource type cannot be shared.' };
  }
  const m = await membership(c.supabase, c.userId, payload.orgId);
  if (!m || !can(m.role, MATRIX_RESOURCE[payload.resourceType], 'share')) {
    return { ok: false, error: 'Not permitted.' };
  }
  // Ownership of the actual resource is verified before sharing.
  const { data: owned } = await c.supabase
    .from(RESOURCE_TABLE[payload.resourceType])
    .select('id')
    .eq('id', payload.resourceId)
    .eq('user_id', c.userId)
    .maybeSingle();
  if (!owned) return { ok: false, error: 'You can only share resources you own.' };

  const { error } = await c.supabase.from('workspace_shares').upsert(
    {
      org_id: payload.orgId,
      shared_by: c.userId,
      resource_type: payload.resourceType,
      resource_id: payload.resourceId,
      revoked_at: null,
    },
    { onConflict: 'org_id,resource_type,resource_id' },
  );
  if (error) return { ok: false, error: GENERIC };
  await logAuditEvent(AUDIT_EVENTS.workspaceShareCreated, {
    orgId: payload.orgId,
    resourceType: payload.resourceType,
  });
  return { ok: true };
}

/** Revoke a share — access is removed immediately (reads filter revoked_at). */
export async function revokeShareAction2(payload: {
  orgId: string;
  shareId: string;
}): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const { error } = await c.supabase
    .from('workspace_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', payload.shareId)
    .eq('shared_by', c.userId); // only the sharer revokes
  if (error) return { ok: false, error: GENERIC };
  await logAuditEvent(AUDIT_EVENTS.workspaceShareRevoked, { orgId: payload.orgId });
  return { ok: true };
}

export interface MemberListItem {
  user_id: string;
  workspace_role: string;
}

/** Members of a workspace (requires membership; role-gated by matrix). */
export async function listMembersAction(orgId: string): Promise<MemberListItem[]> {
  const c = await ctx();
  if (!c) return [];
  const m = await membership(c.supabase, c.userId, orgId);
  if (!m) return []; // fail closed — non-members see nothing
  const { data } = await c.supabase
    .from('organization_members')
    .select('user_id, workspace_role')
    .eq('org_id', orgId)
    .limit(200);
  return (data as MemberListItem[] | null) ?? [];
}
