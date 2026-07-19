/**
 * Phase 12.1 security hardening — one focused test per implemented finding.
 * Each assertion fails against the pre-fix code and passes after it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { consumeRateLimit, resetRateLimitStore } from '@/features/api/rate-limit-store';
import { apiRateLimitFor } from '@/features/api/rate-limit';
import { clientIp, rateLimitSubject } from '@/features/api/request';
import { hashToken } from '@/features/workspaces/api-tokens';
import {
  createWorkspaceSchema,
  inviteMemberSchema,
  changeMemberRoleSchema,
  createApiTokenSchema,
} from '@/features/workspaces/schemas';
import { serializeJsonLd } from '@/features/marketing/seo';
import { isWebhookBodyTooLarge, MAX_WEBHOOK_BODY_BYTES } from '@/features/billing/webhook-limits';

// ── Finding #1: API rate limiting is actually enforced ──────────────────────
describe('#1 API rate limiting (store + subject derivation)', () => {
  beforeEach(() => resetRateLimitStore());

  it('allows up to the plan budget then denies with a retry hint', () => {
    const config = { limit: 3, windowSec: 60 };
    const results = Array.from({ length: 4 }, () => consumeRateLimit('subject-a', config, 1_000));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    const denied = results[3]!;
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterSec).toBeGreaterThan(0);
  });

  it('isolates budgets per subject — one caller cannot exhaust another', () => {
    const config = { limit: 1, windowSec: 60 };
    expect(consumeRateLimit('caller-a', config, 1_000).allowed).toBe(true);
    expect(consumeRateLimit('caller-a', config, 1_000).allowed).toBe(false);
    // A different subject still has its full budget.
    expect(consumeRateLimit('caller-b', config, 1_000).allowed).toBe(true);
  });

  it('resets when the window rolls over', () => {
    const config = { limit: 1, windowSec: 60 };
    expect(consumeRateLimit('roll', config, 1_000).allowed).toBe(true);
    expect(consumeRateLimit('roll', config, 1_000).allowed).toBe(false);
    expect(consumeRateLimit('roll', config, 1_061).allowed).toBe(true); // next window
  });

  it('does not increment the counter on a denied request (no lockout drift)', () => {
    const config = { limit: 1, windowSec: 60 };
    consumeRateLimit('x', config, 1_000);
    const first = consumeRateLimit('x', config, 1_000);
    const second = consumeRateLimit('x', config, 1_000);
    expect(first.retryAfterSec).toBe(second.retryAfterSec);
  });

  it('free tier is the most conservative budget (fail closed, never generous)', () => {
    expect(apiRateLimitFor('free').limit).toBeLessThan(apiRateLimitFor('pro').limit);
  });

  it('keys authenticated callers by token HASH — never the raw secret', () => {
    const token = 'mtt_supersecretvalue';
    const subject = rateLimitSubject(new Request('https://x.test'), token);
    expect(subject).not.toContain(token);
    expect(subject).toBe(`tok:${hashToken(token)}`);
  });

  it('falls back to client IP so anonymous probing is still throttled', () => {
    const req = new Request('https://x.test', {
      headers: { 'x-forwarded-for': '203.0.113.9, 70.41.3.18' },
    });
    expect(clientIp(req)).toBe('203.0.113.9'); // leftmost = real client behind proxy
    expect(rateLimitSubject(req, null)).toBe('ip:203.0.113.9');
  });

  it('never throws on a request with no IP headers', () => {
    expect(rateLimitSubject(new Request('https://x.test'), null)).toBe('ip:unknown');
  });
});

// ── Finding #2: Server Action runtime validation ────────────────────────────
describe('#2 Server Action input validation (types are erased at runtime)', () => {
  it('rejects non-string / out-of-bounds workspace names', () => {
    expect(createWorkspaceSchema.safeParse({ evil: true }).success).toBe(false);
    expect(createWorkspaceSchema.safeParse('a').success).toBe(false);
    expect(createWorkspaceSchema.safeParse('x'.repeat(61)).success).toBe(false);
    expect(createWorkspaceSchema.safeParse('  Acme Trading  ').success).toBe(true);
  });

  it('rejects a non-uuid orgId before it can reach a database query', () => {
    const bad = inviteMemberSchema.safeParse({
      orgId: "'; drop table organizations;--",
      email: 'a@b.co',
      role: 'trader',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects an object/array smuggled where a string id is expected', () => {
    const bad = changeMemberRoleSchema.safeParse({
      orgId: { $ne: null },
      memberUserId: ['x'],
      role: 'admin',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects an unknown role (reusing the single roles.ts source of truth)', () => {
    const base = {
      orgId: '11111111-1111-4111-8111-111111111111',
      memberUserId: '22222222-2222-4222-8222-222222222222',
    };
    expect(changeMemberRoleSchema.safeParse({ ...base, role: 'superuser' }).success).toBe(false);
    expect(changeMemberRoleSchema.safeParse({ ...base, role: 'admin' }).success).toBe(true);
  });

  it('bounds API-token scope arrays and name length', () => {
    const org = '11111111-1111-4111-8111-111111111111';
    expect(createApiTokenSchema.safeParse({ orgId: org, name: 'k', scopes: [] }).success).toBe(
      false,
    );
    expect(
      createApiTokenSchema.safeParse({
        orgId: org,
        name: 'k',
        scopes: Array.from({ length: 33 }, () => 's'),
      }).success,
    ).toBe(false);
    expect(
      createApiTokenSchema.safeParse({ orgId: org, name: 'CI token', scopes: ['reports:view'] })
        .success,
    ).toBe(true);
  });
});

// ── Finding #8: JSON-LD serialization cannot break out of <script> ──────────
describe('#8 JSON-LD serializer escaping', () => {
  it('escapes "<" so a value can never terminate the script block', () => {
    const out = serializeJsonLd({ name: '</script><img onerror=alert(1)>' });
    expect(out).not.toContain('</script>');
    expect(out).toContain('\\u003c');
  });

  it('escapes U+2028/U+2029 (invalid raw in JS string literals)', () => {
    const out = serializeJsonLd({ a: ' ', b: ' ' });
    expect(out).toContain('\\u2028');
    expect(out).toContain('\\u2029');
  });

  it('still round-trips to the original value', () => {
    const value = { '@type': 'FAQPage', q: 'Is 5 < 6?' };
    expect(JSON.parse(serializeJsonLd(value))).toEqual(value);
  });
});

// ── Finding #4: webhook body size cap (before signature verification) ───────
describe('#4 billing webhook body size limit', () => {
  it('accepts a realistic provider event', () => {
    expect(isWebhookBodyTooLarge('2048', 2048)).toBe(false);
  });

  it('rejects an oversized declared content-length before any HMAC work', () => {
    expect(isWebhookBodyTooLarge(String(MAX_WEBHOOK_BODY_BYTES + 1))).toBe(true);
  });

  it('rejects on actual bytes when content-length is absent (header omitted)', () => {
    expect(isWebhookBodyTooLarge(null, MAX_WEBHOOK_BODY_BYTES + 1)).toBe(true);
  });

  it('cannot be bypassed by a lying content-length header', () => {
    // Header claims tiny, body is actually huge → still rejected.
    expect(isWebhookBodyTooLarge('10')).toBe(false);
    expect(isWebhookBodyTooLarge('10', MAX_WEBHOOK_BODY_BYTES + 1)).toBe(true);
  });

  it('treats a malformed content-length as unknown rather than allowing it', () => {
    expect(isWebhookBodyTooLarge('not-a-number')).toBe(false);
    expect(isWebhookBodyTooLarge('not-a-number', MAX_WEBHOOK_BODY_BYTES + 1)).toBe(true);
  });

  it('accepts exactly the boundary value', () => {
    expect(isWebhookBodyTooLarge(String(MAX_WEBHOOK_BODY_BYTES), MAX_WEBHOOK_BODY_BYTES)).toBe(
      false,
    );
  });
});
