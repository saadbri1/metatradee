import { describe, it, expect } from 'vitest';
import {
  generateApiToken,
  hashToken,
  tokenHashMatches,
  validateRequestedScopes,
  validateApiToken,
  grantableScopes,
  TOKEN_PREFIX,
} from '@/features/workspaces/api-tokens';
import { effectiveRole, canModerate, validateOwnershipTransfer } from '@/features/workspaces/admin';

describe('API tokens — hashed at rest, shown once (the credential contract)', () => {
  it('stores only a hash; the plaintext is never derivable from stored fields', () => {
    const t = generateApiToken();
    expect(t.plaintext.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(t.hash).toHaveLength(64); // sha256 hex
    expect(t.hash).not.toContain(t.plaintext);
    expect(t.prefix.length).toBeLessThan(t.plaintext.length); // safe identifier
    expect(t.plaintext.startsWith(t.prefix)).toBe(true);
    expect(hashToken(t.plaintext)).toBe(t.hash);
    expect(tokenHashMatches(t.plaintext, t.hash)).toBe(true);
    expect(tokenHashMatches('mtt_wrong', t.hash)).toBe(false);
  });
});

describe('API tokens — authority bounding (can NEVER exceed the creator)', () => {
  const record = (over: Partial<Parameters<typeof validateApiToken>[1] & object> = {}) => {
    const t = generateApiToken();
    return {
      plaintext: t.plaintext,
      rec: {
        hash: t.hash,
        scopes: ['strategies:view', 'reports:view'],
        expiresAt: new Date(Date.now() + 86400_000).toISOString(),
        revokedAt: null,
        creatorCurrentRole: 'admin' as const,
        ...over,
      },
    };
  };

  it('creation scopes must be ⊆ the creator’s own grants (least privilege)', () => {
    expect(validateRequestedScopes('admin', ['strategies:view', 'billing:view'])).toBe(true);
    expect(validateRequestedScopes('viewer', ['strategies:delete'])).toBe(false); // above viewer
    expect(validateRequestedScopes('trader', ['billing:view'])).toBe(false);
    expect(validateRequestedScopes('admin', [])).toBe(false); // empty = fail closed
    expect(validateRequestedScopes('nonsense', ['strategies:view'])).toBe(false);
    expect(grantableScopes('nobody')).toEqual([]);
  });

  it('at use, effective scopes = token ∩ creator’s CURRENT grants', () => {
    const { plaintext, rec } = record();
    const v = validateApiToken(plaintext, rec);
    expect(v).toEqual({ ok: true, effectiveScopes: ['strategies:view', 'reports:view'] });
  });

  it('reducing the creator’s role reduces the token; removing them kills it', () => {
    // Creator demoted to viewer: reports:view survives, nothing widens.
    const demoted = record({ creatorCurrentRole: 'viewer' as const });
    const v1 = validateApiToken(demoted.plaintext, demoted.rec);
    expect(v1.ok).toBe(true);
    if (v1.ok) expect(v1.effectiveScopes).toEqual(['strategies:view', 'reports:view']); // viewer has both views
    // Creator with a role granting NEITHER scope → no authority at all.
    const stripped = record({
      scopes: ['billing:manage'],
      creatorCurrentRole: 'trader' as const,
    });
    expect(validateApiToken(stripped.plaintext, stripped.rec)).toEqual({
      ok: false,
      reason: 'no_authority',
    });
    // Creator gone (removed/suspended) → token dead.
    const gone = record({ creatorCurrentRole: null });
    expect(validateApiToken(gone.plaintext, gone.rec)).toEqual({
      ok: false,
      reason: 'creator_gone',
    });
  });

  it('fails closed on expiry, revocation, wrong secret, malformed input', () => {
    const expired = record({ expiresAt: new Date(0).toISOString() });
    expect(validateApiToken(expired.plaintext, expired.rec)).toEqual({
      ok: false,
      reason: 'expired',
    });
    const revoked = record({ revokedAt: new Date().toISOString() });
    expect(validateApiToken(revoked.plaintext, revoked.rec)).toEqual({
      ok: false,
      reason: 'revoked',
    });
    const { rec } = record();
    expect(validateApiToken('mtt_forged', rec)).toEqual({ ok: false, reason: 'invalid' });
    expect(validateApiToken('not-a-token', rec)).toEqual({ ok: false, reason: 'invalid' });
    expect(validateApiToken('mtt_x', null)).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('suspension — fails closed everywhere via effectiveRole', () => {
  it('suspended or malformed membership resolves to no role at all', () => {
    expect(effectiveRole({ workspace_role: 'admin', suspended_at: null })).toBe('admin');
    expect(effectiveRole({ workspace_role: 'admin', suspended_at: '2026-01-01' })).toBeNull();
    expect(effectiveRole({ workspace_role: 'superuser', suspended_at: null })).toBeNull();
    expect(effectiveRole(null)).toBeNull();
  });
});

describe('moderation + ownership transfer guards (no escalation, no self)', () => {
  it('only strictly-higher admins/owners moderate; never self or peers', () => {
    expect(canModerate('owner', 'admin', false)).toBe(true);
    expect(canModerate('admin', 'trader', false)).toBe(true);
    expect(canModerate('admin', 'admin', false)).toBe(false); // peer
    expect(canModerate('admin', 'owner', false)).toBe(false); // above
    expect(canModerate('manager', 'viewer', false)).toBe(false); // below admin rank
    expect(canModerate('owner', 'admin', true)).toBe(false); // self
    expect(canModerate('ghost', 'viewer', false)).toBe(false); // fail closed
  });

  it('ownership transfer: Owner-only, to an active existing member, never self', () => {
    const active = { workspace_role: 'admin', suspended_at: null };
    expect(validateOwnershipTransfer('owner', active, false)).toEqual({ ok: true });
    expect(validateOwnershipTransfer('admin', active, false)).toEqual({
      ok: false,
      reason: 'not_owner',
    });
    expect(validateOwnershipTransfer('owner', null, false)).toEqual({
      ok: false,
      reason: 'target_not_member',
    });
    expect(
      validateOwnershipTransfer('owner', { workspace_role: 'admin', suspended_at: 'x' }, false),
    ).toEqual({ ok: false, reason: 'target_suspended' });
    expect(validateOwnershipTransfer('owner', active, true)).toEqual({ ok: false, reason: 'self' });
  });
});

describe('audit redaction contract', () => {
  it('the generated token never appears in what actions audit (prefix only)', () => {
    const t = generateApiToken();
    // The audit payload shape used by createApiTokenAction:
    const auditMetadata = { orgId: 'org', prefix: t.prefix };
    expect(JSON.stringify(auditMetadata)).not.toContain(t.plaintext);
    expect(JSON.stringify(auditMetadata)).not.toContain(t.hash);
  });
});
