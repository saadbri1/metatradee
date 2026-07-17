import { describe, it, expect } from 'vitest';
import {
  isBlockedIp,
  isBlockedHostname,
  validateWebhookUrl,
  assertResolvedIpsAllowed,
} from '@/features/api/ssrf';
import {
  buildWebhookPayload,
  payloadIsClean,
  signWebhook,
  verifyWebhook,
  nextRetryDelay,
  shouldAutoDisable,
} from '@/features/api/webhooks';
import { apiError, page, clampLimit, isValidIdempotencyKey, statusFor } from '@/features/api/http';
import { parseBearer, authorize, canReadPsychology, PSYCHOLOGY_SCOPE } from '@/features/api/auth';
import { apiRateLimitFor, checkRateLimit, rateLimitHeaders } from '@/features/api/rate-limit';
import { API_ROUTES, buildOpenApiSpec } from '@/features/api/openapi';
import { generateApiToken } from '@/features/workspaces/api-tokens';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

describe('SSRF egress guard (the critical new risk)', () => {
  it('blocks loopback / private / link-local / metadata IPs', () => {
    for (const ip of [
      '127.0.0.1',
      '10.0.0.5',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254', // cloud metadata
      '0.0.0.0',
      '100.64.0.1', // CGNAT
      '::1',
      'fe80::1',
      'fd00::1',
      '::ffff:127.0.0.1', // IPv4-mapped loopback
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it('allows genuine public IPs', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111']) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });

  it('blocks internal hostnames', () => {
    expect(isBlockedHostname('localhost')).toBe(true);
    expect(isBlockedHostname('foo.local')).toBe(true);
    expect(isBlockedHostname('metadata.google.internal')).toBe(true);
    expect(isBlockedHostname('example.com')).toBe(false);
  });

  it('validateWebhookUrl: HTTPS-only + literal-IP + hostname gates', () => {
    expect(validateWebhookUrl('http://example.com/hook')).toEqual({
      ok: false,
      reason: 'not_https',
    });
    expect(validateWebhookUrl('https://169.254.169.254/')).toEqual({
      ok: false,
      reason: 'blocked_ip',
    });
    expect(validateWebhookUrl('https://localhost/hook')).toEqual({
      ok: false,
      reason: 'blocked_host',
    });
    expect(validateWebhookUrl('not a url')).toEqual({ ok: false, reason: 'invalid_url' });
    expect(validateWebhookUrl('https://hooks.example.com/x')).toEqual({ ok: true });
  });

  it('post-DNS gate rejects if ANY resolved address is private (rebinding guard)', () => {
    expect(assertResolvedIpsAllowed(['93.184.216.34']).ok).toBe(true);
    expect(assertResolvedIpsAllowed(['93.184.216.34', '10.0.0.1']).ok).toBe(false);
    expect(assertResolvedIpsAllowed([]).ok).toBe(false); // no address → refuse
  });
});

describe('outbound webhooks — minimal payload + signing + retry', () => {
  it('payloads carry IDs only, no sensitive content', () => {
    const p = buildWebhookPayload('dlv_1', 'trade.created', { id: 'trade_9', workspaceId: 'ws_1' });
    expect(p.data).toEqual({ id: 'trade_9', workspaceId: 'ws_1' });
    expect(payloadIsClean(p)).toBe(true);
    // A payload that smuggled a note/secret is flagged.
    expect(payloadIsClean({ data: { id: 'x', note: 'my feelings' } })).toBe(false);
    expect(payloadIsClean({ data: { id: 'x', psychology: {} } })).toBe(false);
  });

  it('signs and verifies (constant-time, replay window)', () => {
    const body = JSON.stringify({ id: 'dlv_1' });
    const t = Math.floor(Date.now() / 1000);
    const header = signWebhook(body, 'whsec_test', t);
    expect(verifyWebhook(body, header, 'whsec_test')).toBe(true);
    expect(verifyWebhook('{"id":"evil"}', header, 'whsec_test')).toBe(false);
    expect(verifyWebhook(body, header, 'wrong')).toBe(false);
    const old = signWebhook(body, 'whsec_test', t - 10_000);
    expect(verifyWebhook(body, old, 'whsec_test')).toBe(false); // replay-stale
  });

  it('retries back off then dead-letter; auto-disables on sustained failure', () => {
    expect(nextRetryDelay(0)).toBe(30);
    expect(nextRetryDelay(4)).toBe(21600);
    expect(nextRetryDelay(5)).toBeNull(); // → dead-letter
    expect(shouldAutoDisable(14)).toBe(false);
    expect(shouldAutoDisable(15)).toBe(true);
  });
});

describe('API contract — error format, pagination, idempotency', () => {
  it('one error envelope; codes map to status', () => {
    expect(apiError('forbidden', 'nope')).toEqual({
      error: { code: 'forbidden', message: 'nope' },
    });
    expect(statusFor('rate_limited')).toBe(429);
    expect(statusFor('not_found')).toBe(404);
    expect(statusFor('weird')).toBe(400);
  });

  it('cursor pagination reports hasMore + nextCursor', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const p = page(items, 2, (i) => i.id);
    expect(p.data).toHaveLength(2);
    expect(p.pagination).toEqual({ hasMore: true, nextCursor: 'b' });
    const p2 = page([{ id: 'a' }], 2, (i) => i.id);
    expect(p2.pagination).toEqual({ hasMore: false, nextCursor: null });
    expect(clampLimit('9999')).toBe(200);
    expect(clampLimit('abc')).toBe(50);
  });

  it('idempotency keys must be well-formed (fail closed)', () => {
    expect(isValidIdempotencyKey('a1b2c3d4e5')).toBe(true);
    expect(isValidIdempotencyKey('short')).toBe(false);
    expect(isValidIdempotencyKey('has spaces!!')).toBe(false);
    expect(isValidIdempotencyKey(123)).toBe(false);
  });
});

describe('API auth — reuses 11.1 token model, fails closed, scope-enforced', () => {
  const record = (scopes: string[], role: 'admin' | 'viewer' | null = 'admin') => {
    const t = generateApiToken();
    return {
      plaintext: t.plaintext,
      rec: {
        hash: t.hash,
        scopes,
        expiresAt: new Date(Date.now() + 86400_000).toISOString(),
        revokedAt: null,
        creatorCurrentRole: role,
      },
    };
  };

  it('parses only well-formed mtt_ bearer tokens', () => {
    expect(parseBearer('Bearer mtt_abc')).toBe('mtt_abc');
    expect(parseBearer('Bearer notatoken')).toBeNull();
    expect(parseBearer('mtt_abc')).toBeNull();
    expect(parseBearer(null)).toBeNull();
  });

  it('401 for missing/invalid, 403 for insufficient scope, ok within scope', () => {
    const { plaintext, rec } = record(['reports:view']);
    expect(authorize(null, rec, 'reports:view').ok).toBe(false);
    expect(authorize('mtt_forged', rec, 'reports:view')).toMatchObject({ status: 401 });
    expect(authorize(plaintext, rec, 'billing:view')).toMatchObject({
      status: 403,
      code: 'forbidden',
    });
    expect(authorize(plaintext, rec, 'reports:view').ok).toBe(true);
  });

  it('psychology needs the dedicated scope AND owner opt-in; never via delegated authority', () => {
    // A workspace role never grants the personal psychology scope, so a token
    // scoped to it can never yield it. Even holding the scope, opt-in gates it.
    expect(canReadPsychology([PSYCHOLOGY_SCOPE], true)).toBe(true);
    expect(canReadPsychology([PSYCHOLOGY_SCOPE], false)).toBe(false); // no opt-in
    expect(canReadPsychology(['reports:view'], true)).toBe(false); // no scope
  });
});

describe('rate limiting — plan-driven, standard headers, fail closed', () => {
  it('quota scales with plan and is not hardcoded per endpoint', () => {
    expect(apiRateLimitFor('free').limit).toBeLessThan(apiRateLimitFor('pro').limit);
  });

  it('fixed-window decision + headers', () => {
    const cfg = apiRateLimitFor('free'); // 30/min
    const under = checkRateLimit(5, cfg, 1000);
    expect(under.allowed).toBe(true);
    expect(under.remaining).toBe(24);
    const over = checkRateLimit(30, cfg, 1000);
    expect(over.allowed).toBe(false);
    expect(over.retryAfterSec).toBeGreaterThan(0);
    expect(rateLimitHeaders(over)['Retry-After']).toBeDefined();
    expect(rateLimitHeaders(under)['RateLimit-Remaining']).toBe('24');
  });
});

describe('OpenAPI is the source of truth — spec matches implemented routes (no drift)', () => {
  it('every declared route is marked sensitive iff psychology; spec builds', () => {
    const spec = buildOpenApiSpec();
    expect(spec.openapi).toBe('3.1.0');
    const psych = API_ROUTES.find((r) => r.path === '/psychology');
    expect(psych?.sensitive).toBe(true);
    expect(psych?.scope).toBe('psychology:read:self');
    // Non-sensitive endpoints are not flagged sensitive.
    expect(API_ROUTES.filter((r) => r.sensitive).map((r) => r.path)).toEqual(['/psychology']);
  });

  it('every implemented /api/v1 route file is declared in the spec', () => {
    const v1Dir = join(process.cwd(), 'src', 'app', 'api', 'v1');
    const implemented = readdirSync(v1Dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => `/${d.name}`);
    for (const path of implemented) {
      expect(API_ROUTES.map((r) => r.path)).toContain(path);
    }
  });
});
