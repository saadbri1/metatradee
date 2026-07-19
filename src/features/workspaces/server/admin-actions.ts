'use server';

/**
 * Enterprise admin actions (Phase 11.1). Every action: auth → membership+role
 * re-validated (suspended = none, fail closed) → moderation/authority guards →
 * audited with METADATA ONLY (a token's plaintext or hash never reaches a log
 * or audit row — only its public prefix).
 *
 * Admin governs the org, never a member's personal data: nothing here reads
 * trades, psychology, journals, or AI reviews.
 *
 * FLAGGED SEAMS (pending live infra, per the deploy hold):
 *  - Force-logout of ANOTHER user needs the Supabase admin API (service role,
 *    live) — self sign-out-everywhere already exists in Auth.
 *  - Ownership-transfer re-auth/MFA step-up needs a live AAL check (9.2
 *    getMfaStateAction) — enforced here as a documented precondition.
 */
import { createClient } from '@/lib/supabase/server';
import { AUDIT_EVENTS } from '@/features/auth/config';
import { logAuditEvent } from '@/features/auth/server/audit';
import { effectiveRole, canModerate, validateOwnershipTransfer } from '../admin';
import { generateApiToken, validateRequestedScopes, grantableScopes } from '../api-tokens';
import { isWorkspaceRole, type WorkspaceRole } from '../roles';
import { createApiTokenSchema } from '../schemas';

interface ActionResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}
const GENERIC = 'Something went wrong. Please try again.';
const MAX_ACTIVE_TOKENS_PER_ORG = 20;
const DEFAULT_TOKEN_TTL_DAYS = 90;

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { userId: user.id, supabase } : null;
}

async function activeRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  orgId: string,
): Promise<WorkspaceRole | null> {
  const { data } = await supabase
    .from('organization_members')
    .select('workspace_role, suspended_at')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();
  return effectiveRole(data as { workspace_role: string; suspended_at: string | null } | null);
}

async function targetRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  memberUserId: string,
) {
  const { data } = await supabase
    .from('organization_members')
    .select('workspace_role, suspended_at')
    .eq('org_id', orgId)
    .eq('user_id', memberUserId)
    .maybeSingle();
  return data as { workspace_role: string; suspended_at: string | null } | null;
}

/** Suspend — access fails closed immediately; nothing is deleted. */
export async function suspendMemberAction(
  orgId: string,
  memberUserId: string,
): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const actor = await activeRole(c.supabase, c.userId, orgId);
  const target = await targetRow(c.supabase, orgId, memberUserId);
  if (!actor || !canModerate(actor, target?.workspace_role, c.userId === memberUserId)) {
    return { ok: false, error: 'Not permitted.' };
  }
  const { error } = await c.supabase
    .from('organization_members')
    .update({ suspended_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('user_id', memberUserId);
  if (error) return { ok: false, error: GENERIC };
  await logAuditEvent(AUDIT_EVENTS.memberSuspended, { orgId });
  return { ok: true };
}

/** Reactivate — restores prior role/access exactly. */
export async function reactivateMemberAction(
  orgId: string,
  memberUserId: string,
): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const actor = await activeRole(c.supabase, c.userId, orgId);
  const target = await targetRow(c.supabase, orgId, memberUserId);
  if (!actor || !canModerate(actor, target?.workspace_role, c.userId === memberUserId)) {
    return { ok: false, error: 'Not permitted.' };
  }
  const { error } = await c.supabase
    .from('organization_members')
    .update({ suspended_at: null })
    .eq('org_id', orgId)
    .eq('user_id', memberUserId);
  if (error) return { ok: false, error: GENERIC };
  await logAuditEvent(AUDIT_EVENTS.memberReactivated, { orgId });
  return { ok: true };
}

/**
 * Remove — revokes org access + the member's shares INTO this org. Personal
 * data is never deleted; their authored shares are revoked (not destroyed).
 */
export async function removeMemberAction(
  orgId: string,
  memberUserId: string,
): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const actor = await activeRole(c.supabase, c.userId, orgId);
  const target = await targetRow(c.supabase, orgId, memberUserId);
  if (!actor || !canModerate(actor, target?.workspace_role, c.userId === memberUserId)) {
    return { ok: false, error: 'Not permitted.' };
  }
  await c.supabase
    .from('workspace_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('shared_by', memberUserId)
    .is('revoked_at', null);
  const { error } = await c.supabase
    .from('organization_members')
    .delete()
    .eq('org_id', orgId)
    .eq('user_id', memberUserId);
  if (error) return { ok: false, error: GENERIC };
  await logAuditEvent(AUDIT_EVENTS.memberRemoved, { orgId });
  return { ok: true };
}

/**
 * Ownership transfer — Owner-only, to an active member. PRECONDITION (flagged):
 * on a live deployment the caller must have a fresh AAL2 session where MFA is
 * enforced (9.2 getMfaStateAction) — wire the step-up check before shipping.
 */
export async function transferOwnershipAction(
  orgId: string,
  newOwnerUserId: string,
): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const actor = await activeRole(c.supabase, c.userId, orgId);
  const target = await targetRow(c.supabase, orgId, newOwnerUserId);
  const verdict = validateOwnershipTransfer(actor, target, c.userId === newOwnerUserId);
  if (!verdict.ok) return { ok: false, error: 'Ownership transfer not permitted.' };

  const { error: promoteErr } = await c.supabase
    .from('organization_members')
    .update({ role: 'owner', workspace_role: 'owner' })
    .eq('org_id', orgId)
    .eq('user_id', newOwnerUserId);
  if (promoteErr) return { ok: false, error: GENERIC };
  const { error: demoteErr } = await c.supabase
    .from('organization_members')
    .update({ role: 'admin', workspace_role: 'admin' })
    .eq('org_id', orgId)
    .eq('user_id', c.userId);
  if (demoteErr) return { ok: false, error: GENERIC };
  await logAuditEvent(AUDIT_EVENTS.ownershipTransferred, { orgId });
  return { ok: true };
}

/** Create an API token. Plaintext is returned ONCE and never persisted/logged. */
export async function createApiTokenAction(
  rawPayload: unknown,
): Promise<ActionResult<{ token: string; prefix: string }>> {
  // Runtime boundary check before any value reaches authorization or the DB.
  const parsedInput = createApiTokenSchema.safeParse(rawPayload);
  if (!parsedInput.success) return { ok: false, error: 'Invalid API token request.' };
  const payload = parsedInput.data;
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const role = await activeRole(c.supabase, c.userId, payload.orgId);
  if (!role || !isWorkspaceRole(role) || !(role === 'owner' || role === 'admin')) {
    return { ok: false, error: 'Only workspace owners and admins can create API tokens.' };
  }
  // Least privilege: requested scopes must be within the CREATOR'S OWN grants.
  if (!validateRequestedScopes(role, payload.scopes)) {
    return { ok: false, error: 'Requested scopes exceed your permissions or are empty.' };
  }
  const name = payload.name.trim();
  if (name.length < 1 || name.length > 60)
    return { ok: false, error: 'Name must be 1–60 characters.' };

  // Rate limit: bounded active tokens per org.
  const { count } = await c.supabase
    .from('api_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', payload.orgId)
    .is('revoked_at', null);
  if ((count ?? 0) >= MAX_ACTIVE_TOKENS_PER_ORG) {
    return { ok: false, error: 'Token limit reached — revoke unused tokens first.' };
  }

  const generated = generateApiToken();
  const expiresAt = new Date(Date.now() + DEFAULT_TOKEN_TTL_DAYS * 86400_000).toISOString();
  const { error } = await c.supabase.from('api_tokens').insert({
    org_id: payload.orgId,
    created_by: c.userId,
    name,
    prefix: generated.prefix,
    token_hash: generated.hash,
    scopes: payload.scopes,
    expires_at: expiresAt,
  });
  if (error) return { ok: false, error: GENERIC };
  // AUDIT REDACTION: prefix only — never the plaintext or hash.
  await logAuditEvent(AUDIT_EVENTS.apiTokenCreated, {
    orgId: payload.orgId,
    prefix: generated.prefix,
  });
  return { ok: true, data: { token: generated.plaintext, prefix: generated.prefix } };
}

/** Revoke — effective immediately (validation checks revoked_at first). */
export async function revokeApiTokenAction(orgId: string, tokenId: string): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const role = await activeRole(c.supabase, c.userId, orgId);
  if (!role || !(role === 'owner' || role === 'admin'))
    return { ok: false, error: 'Not permitted.' };
  const { data, error } = await c.supabase
    .from('api_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
    .eq('org_id', orgId)
    .select('prefix')
    .single();
  if (error) return { ok: false, error: GENERIC };
  await logAuditEvent(AUDIT_EVENTS.apiTokenRevoked, {
    orgId,
    prefix: (data as { prefix: string } | null)?.prefix,
  });
  return { ok: true };
}

/** Rotate = revoke old + issue new with the same name/scopes (shown once). */
export async function rotateApiTokenAction(
  orgId: string,
  tokenId: string,
): Promise<ActionResult<{ token: string; prefix: string }>> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const { data: old } = await c.supabase
    .from('api_tokens')
    .select('name, scopes')
    .eq('id', tokenId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!old) return { ok: false, error: 'Token not found.' };
  const revoked = await revokeApiTokenAction(orgId, tokenId);
  if (!revoked.ok) return { ok: false, error: revoked.error };
  const created = await createApiTokenAction({
    orgId,
    name: (old as { name: string }).name,
    scopes: (old as { scopes: string[] }).scopes,
  });
  if (created.ok) await logAuditEvent(AUDIT_EVENTS.apiTokenRotated, { orgId });
  return created;
}

export interface TokenListItem {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

/** List tokens — prefix + metadata only; hashes/plaintext never leave the DB. */
export async function listApiTokensAction(orgId: string): Promise<TokenListItem[]> {
  const c = await ctx();
  if (!c) return [];
  const role = await activeRole(c.supabase, c.userId, orgId);
  if (!role || !(role === 'owner' || role === 'admin')) return [];
  const { data } = await c.supabase
    .from('api_tokens')
    .select('id, name, prefix, scopes, expires_at, revoked_at, last_used_at, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100);
  return (data as TokenListItem[] | null) ?? [];
}

/** Scopes the current user could grant (for the token-creation UI). */
export async function grantableScopesAction(orgId: string): Promise<string[]> {
  const c = await ctx();
  if (!c) return [];
  const role = await activeRole(c.supabase, c.userId, orgId);
  return [...grantableScopes(role)];
}
