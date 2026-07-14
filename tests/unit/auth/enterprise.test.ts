import { describe, it, expect } from 'vitest';
import {
  resolveEntitlementsFromMetadata,
  permissionsForRole,
  hasPermission,
  hasRole,
} from '@/features/auth/enterprise/rbac';
import {
  computeMfaState,
  isEnrolled,
  DEFAULT_MFA_POLICY,
  type MfaFactor,
} from '@/features/auth/enterprise/mfa';
import {
  domainOf,
  ssoConnectionForEmail,
  type SsoConnection,
} from '@/features/auth/enterprise/sso';

describe('RBAC (roles from tamper-proof app_metadata, fail-closed)', () => {
  it('fails closed to member on missing/invalid role', () => {
    expect(resolveEntitlementsFromMetadata(null).role).toBe('member');
    expect(resolveEntitlementsFromMetadata({}).role).toBe('member');
    expect(resolveEntitlementsFromMetadata({ role: 'superadmin' }).role).toBe('member');
  });

  it('resolves a valid role + organization id', () => {
    const ent = resolveEntitlementsFromMetadata({ role: 'admin', organization_id: 'org_1' });
    expect(ent.role).toBe('admin');
    expect(ent.organizationId).toBe('org_1');
  });

  it('accumulates permissions by rank (owner ⊇ admin ⊇ member)', () => {
    const member = permissionsForRole('member');
    const owner = permissionsForRole('owner');
    expect(member).toContain('journal:read');
    // owner inherits member + admin permissions plus its own.
    for (const p of member) expect(owner).toContain(p);
    expect(owner).toContain('billing:manage');
    expect(member).not.toContain('billing:manage');
  });

  it('permission + role checks default denied / respect ordering', () => {
    const admin = resolveEntitlementsFromMetadata({ role: 'admin' });
    expect(hasPermission(admin, 'members:invite')).toBe(true);
    expect(hasPermission(admin, 'org:manage')).toBe(false); // owner-only
    expect(hasRole(admin, 'member')).toBe(true);
    expect(hasRole(admin, 'owner')).toBe(false);
  });
});

describe('MFA policy logic (fail-closed on required-but-unsatisfied)', () => {
  const verified: MfaFactor[] = [{ id: 'f1', factorType: 'totp', status: 'verified' }];
  const unverified: MfaFactor[] = [{ id: 'f2', factorType: 'totp', status: 'unverified' }];

  it('detects enrollment only from a verified factor', () => {
    expect(isEnrolled(verified)).toBe(true);
    expect(isEnrolled(unverified)).toBe(false);
    expect(isEnrolled([])).toBe(false);
  });

  it('needsChallenge when required + enrolled + only AAL1', () => {
    const s = computeMfaState(
      verified,
      'aal1',
      { ...DEFAULT_MFA_POLICY, userOptedIn: true },
      'member',
    );
    expect(s.required).toBe(true);
    expect(s.enrolled).toBe(true);
    expect(s.satisfied).toBe(false);
    expect(s.needsChallenge).toBe(true);
  });

  it('is satisfied at AAL2 (no challenge needed)', () => {
    const s = computeMfaState(
      verified,
      'aal2',
      { ...DEFAULT_MFA_POLICY, userOptedIn: true },
      'member',
    );
    expect(s.satisfied).toBe(true);
    expect(s.needsChallenge).toBe(false);
  });

  it('enforces MFA for a required role even without opt-in', () => {
    const s = computeMfaState(
      verified,
      'aal1',
      { ...DEFAULT_MFA_POLICY, requireForRoles: ['owner'] },
      'owner',
    );
    expect(s.required).toBe(true);
    expect(s.needsChallenge).toBe(true);
  });

  it('is optional by default', () => {
    const s = computeMfaState([], 'aal1', DEFAULT_MFA_POLICY, 'member');
    expect(s.required).toBe(false);
    expect(s.needsChallenge).toBe(false);
  });
});

describe('SSO domain routing (scaffolding)', () => {
  const conns: SsoConnection[] = [
    { organizationId: 'org_1', provider: 'saml', domain: 'acme.com', isActive: true },
    { organizationId: 'org_2', provider: 'saml', domain: 'old.com', isActive: false },
  ];

  it('extracts the email domain', () => {
    expect(domainOf('jane@Acme.com')).toBe('acme.com');
    expect(domainOf('invalid')).toBeNull();
  });

  it('routes an email to an active SSO connection only', () => {
    expect(ssoConnectionForEmail('jane@acme.com', conns)?.organizationId).toBe('org_1');
    expect(ssoConnectionForEmail('bob@old.com', conns)).toBeNull(); // inactive
    expect(ssoConnectionForEmail('x@other.com', conns)).toBeNull();
  });
});
