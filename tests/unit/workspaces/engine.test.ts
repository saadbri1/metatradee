import { describe, it, expect } from 'vitest';
import {
  PERMISSION_MATRIX,
  DB_ROLE_FOR,
  can,
  canAssignRole,
  isWorkspaceRole,
} from '@/features/workspaces/roles';
import { validateInvite, canInvite, inviteExpiry } from '@/features/workspaces/invitations';
import {
  SHAREABLE_TYPES,
  NEVER_SHAREABLE,
  isShareableType,
  isShareActive,
} from '@/features/workspaces/sharing';
import type { WorkspaceRole } from '@/features/workspaces/roles';

const ALL_ROLES: WorkspaceRole[] = ['owner', 'admin', 'manager', 'coach', 'trader', 'viewer'];

describe('PRIVACY BY CONSTRUCTION (the critical guarantee)', () => {
  it('the permission matrix contains NO personal-data resource for ANY role', () => {
    const forbidden = /psychology|journal|trade|habit|goal|ai_review|note/i;
    for (const role of ALL_ROLES) {
      for (const grant of PERMISSION_MATRIX[role]) {
        expect(grant).not.toMatch(forbidden);
      }
    }
  });

  it('personal data types are structurally unshareable', () => {
    for (const t of NEVER_SHAREABLE) {
      expect(isShareableType(t)).toBe(false);
      // Even an unrevoked "share" of a personal type grants nothing.
      expect(isShareActive({ resourceType: t, revokedAt: null })).toBe(false);
    }
    expect(SHAREABLE_TYPES).toEqual(['strategy', 'playbook', 'report', 'tag', 'template']);
  });

  it('no role — including Owner/Coach/Manager — has any psychology grant', () => {
    // Belt-and-suspenders: can() rejects unknown resources, so even asking is denied.
    for (const role of ALL_ROLES) {
      expect(can(role, 'psychology' as never, 'view' as never)).toBe(false);
    }
  });
});

describe('permission matrix (fail-closed, server-authoritative shape)', () => {
  it('fails closed on unknown role/resource/action', () => {
    expect(can('superuser', 'strategies', 'view')).toBe(false);
    expect(can(null, 'strategies', 'view')).toBe(false);
    expect(can('viewer', 'nonsense' as never, 'view')).toBe(false);
  });

  it('a Viewer can view but never mutate', () => {
    expect(can('viewer', 'strategies', 'view')).toBe(true);
    for (const action of ['create', 'edit', 'delete', 'share', 'manage'] as const) {
      expect(can('viewer', 'strategies', action)).toBe(false);
    }
  });

  it('billing is Owner/Admin only', () => {
    expect(can('owner', 'billing', 'manage')).toBe(true);
    expect(can('admin', 'billing', 'view')).toBe(true);
    for (const role of ['manager', 'coach', 'trader', 'viewer'] as const) {
      expect(can(role, 'billing', 'view')).toBe(false);
    }
  });

  it('only Owner may delete/transfer the workspace', () => {
    expect(can('owner', 'workspace', 'delete')).toBe(true);
    for (const role of ['admin', 'manager', 'coach', 'trader', 'viewer'] as const) {
      expect(can(role, 'workspace', 'delete')).toBe(false);
    }
  });

  it('six roles map onto the locked three-role DB model without escalation', () => {
    expect(DB_ROLE_FOR.owner).toBe('owner');
    expect(DB_ROLE_FOR.admin).toBe('admin');
    for (const r of ['manager', 'coach', 'trader', 'viewer'] as const) {
      expect(DB_ROLE_FOR[r]).toBe('member'); // never elevates DB authority
    }
  });
});

describe('role assignment — no privilege escalation', () => {
  it('an actor can never assign a role at or above their own rank', () => {
    expect(canAssignRole('admin', 'admin')).toBe(false);
    expect(canAssignRole('admin', 'owner')).toBe(false);
    expect(canAssignRole('admin', 'manager')).toBe(true);
    expect(canAssignRole('manager', 'coach')).toBe(false); // manager lacks members:manage
    expect(canAssignRole('owner', 'owner')).toBe(true); // ownership transfer only
    expect(canAssignRole('viewer', 'viewer')).toBe(false);
    expect(canAssignRole('nonsense', 'viewer')).toBe(false); // fail closed
  });
});

describe('invitations (single-use, expiring, email-bound, uniform failure)', () => {
  const base = {
    email: 'Jane@Team.com',
    workspaceRole: 'trader',
    expiresAt: inviteExpiry(),
    acceptedAt: null,
    declinedAt: null,
    revokedAt: null,
  };

  it('accepts only the exact invited email (case-insensitive), authenticated', () => {
    expect(validateInvite(base, 'jane@team.com').ok).toBe(true);
    expect(validateInvite(base, 'other@team.com')).toEqual({ ok: false, reason: 'email_mismatch' });
    expect(validateInvite(base, null)).toEqual({ ok: false, reason: 'email_mismatch' });
  });

  it('rejects expired, used, revoked, and malformed invites (fail closed)', () => {
    expect(
      validateInvite({ ...base, expiresAt: new Date(0).toISOString() }, 'jane@team.com'),
    ).toEqual({ ok: false, reason: 'expired' });
    expect(validateInvite({ ...base, acceptedAt: 'x' }, 'jane@team.com')).toEqual({
      ok: false,
      reason: 'used',
    });
    expect(validateInvite({ ...base, declinedAt: 'x' }, 'jane@team.com')).toEqual({
      ok: false,
      reason: 'used',
    });
    expect(validateInvite({ ...base, revokedAt: 'x' }, 'jane@team.com')).toEqual({
      ok: false,
      reason: 'revoked',
    });
    expect(validateInvite({ ...base, workspaceRole: 'root' }, 'jane@team.com')).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(validateInvite(null, 'jane@team.com')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('an invite cannot grant a role at or above the inviter', () => {
    expect(canInvite('admin', 'owner')).toBe(false);
    expect(canInvite('admin', 'admin')).toBe(false);
    expect(canInvite('coach', 'trader')).toBe(false); // coach cannot invite at all
    expect(canInvite('owner', 'admin')).toBe(true);
  });
});

describe('shared resources (explicit + immediately revocable)', () => {
  it('a revoked share grants nothing', () => {
    expect(isShareActive({ resourceType: 'strategy', revokedAt: null })).toBe(true);
    expect(isShareActive({ resourceType: 'strategy', revokedAt: new Date().toISOString() })).toBe(
      false,
    );
    expect(isShareActive(null)).toBe(false);
  });
});

describe('role guard', () => {
  it('isWorkspaceRole fails closed', () => {
    expect(isWorkspaceRole('coach')).toBe(true);
    expect(isWorkspaceRole('superadmin')).toBe(false);
    expect(isWorkspaceRole(undefined)).toBe(false);
  });
});
