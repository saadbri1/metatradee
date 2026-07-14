import { describe, it, expect } from 'vitest';
import {
  generateShareToken,
  generateSalt,
  hashPassword,
  verifyPassword,
  isShareLive,
} from '@/features/reports/share/tokens';
import { projectSharedReport } from '@/features/reports/share/projection';
import type { RenderedReport, ShareConfig } from '@/features/reports/types';

function report(): RenderedReport {
  return {
    type: 'monthly',
    title: 'Monthly',
    filters: {
      account_id: 'acc-123',
      broker_id: 'brk-9',
      date_from: '2026-01-01',
      date_to: '2026-01-31',
    },
    blocks: [
      { kind: 'kpis', title: 'KPIs', sensitive: false, data: { netProfit: 100 } },
      { kind: 'psychology', title: 'Psychology', sensitive: true, data: { stress: 40 } },
      { kind: 'habit_tracking', title: 'Habits', sensitive: true, data: { streak: 5 } },
    ],
    generatedAt: '2026-02-01T00:00:00Z',
  };
}

const base: ShareConfig = {
  allowDownload: false,
  isPublic: false,
  includePsychology: false,
  expiresAt: null,
  hasPassword: false,
};

describe('share tokens', () => {
  it('generates unguessable, unique tokens', () => {
    const a = generateShareToken();
    const b = generateShareToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43); // 256 bits base64url
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('hashes + verifies passwords, rejecting wrong ones', () => {
    const salt = generateSalt();
    const hash = hashPassword('correct horse', salt);
    expect(verifyPassword('correct horse', salt, hash)).toBe(true);
    expect(verifyPassword('wrong', salt, hash)).toBe(false);
    expect(hash).not.toContain('correct horse'); // raw password never stored
  });

  it('enforces expiry and revocation', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isShareLive({ revokedAt: null, expiresAt: future })).toBe(true);
    expect(isShareLive({ revokedAt: null, expiresAt: past })).toBe(false);
    expect(isShareLive({ revokedAt: new Date().toISOString(), expiresAt: future })).toBe(false);
    expect(isShareLive({ revokedAt: null, expiresAt: null })).toBe(true);
  });
});

describe('shared projection (security-critical: no over-fetch, psychology protected)', () => {
  it('drops psychology/habit blocks by default', () => {
    const p = projectSharedReport(report(), base);
    expect(p.blocks.map((b) => b.kind)).toEqual(['kpis']);
  });

  it('includes psychology only with explicit opt-in on a NON-public share', () => {
    const p = projectSharedReport(report(), { ...base, includePsychology: true });
    expect(p.blocks.map((b) => b.kind)).toContain('psychology');
    expect(p.blocks.map((b) => b.kind)).toContain('habit_tracking');
  });

  it('NEVER includes psychology in a public share, even if opted in', () => {
    const p = projectSharedReport(report(), { ...base, isPublic: true, includePsychology: true });
    expect(p.blocks.map((b) => b.kind)).toEqual(['kpis']);
  });

  it('strips account/broker identifiers — only the date window survives', () => {
    const p = projectSharedReport(report(), base);
    expect(p.dateRange).toEqual({ from: '2026-01-01', to: '2026-01-31' });
    // The projection type has no filters field at all — ids cannot leak.
    expect((p as unknown as { filters?: unknown }).filters).toBeUndefined();
    expect(JSON.stringify(p)).not.toContain('acc-123');
    expect(JSON.stringify(p)).not.toContain('brk-9');
  });

  it('echoes only the granted permissions', () => {
    const p = projectSharedReport(report(), { ...base, allowDownload: true });
    expect(p.permissions).toEqual({ allowDownload: true, isPublic: false });
  });
});
