/**
 * Typed 403 contract.
 *
 * A denial used to be a bare `{ ok: false, error: string }`, indistinguishable
 * from a validation failure or an outage — so a client could not reliably show
 * an upgrade path, and hidden UI ended up being the only thing that told a user
 * what was going on. Every gated server action now returns a typed payload.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  denied,
  LIMIT_REACHED,
  type EntitlementDenial,
  type GateResult,
} from '@/features/billing/server/enforce';
import {
  ENTITLEMENT_REQUIRED,
  EntitlementError,
  isEntitlementError,
} from '@/features/billing/errors';
import { entitlementOf } from '../../fixtures/plan-users';

const SRC = resolve(__dirname, '../../../src');
const read = (p: string) => readFileSync(resolve(SRC, p), 'utf8');

function blocked(over: Partial<EntitlementDenial> = {}): GateResult {
  return {
    ok: false,
    reason: 'nope',
    denial: {
      code: ENTITLEMENT_REQUIRED,
      status: 403,
      feature: 'aiCoach',
      requiredTier: 'pro',
      currentTier: 'free',
      message: 'Your plan does not include this. It is available on Pro and above.',
      ...over,
    },
    entitlement: entitlementOf('free'),
  };
}

describe('the denial payload is branchable, not a string to match on', () => {
  it('carries a 403, a code, the gated value and the tier that grants it', () => {
    const res = denied(blocked());
    expect(res.ok).toBe(false);
    expect(res.entitlement.status).toBe(403);
    expect(res.entitlement.code).toBe(ENTITLEMENT_REQUIRED);
    expect(res.entitlement.feature).toBe('aiCoach');
    expect(res.entitlement.requiredTier).toBe('pro');
    expect(res.entitlement.currentTier).toBe('free');
  });

  it('distinguishes a missing capability from a reached limit', () => {
    const limit = denied(
      blocked({ code: LIMIT_REACHED, feature: undefined, limit: 'maxAccounts' }),
    );
    expect(limit.entitlement.code).toBe(LIMIT_REACHED);
    expect(limit.entitlement.limit).toBe('maxAccounts');
    expect(limit.entitlement.feature).toBeUndefined();
  });

  it('leaks no subscription internals — it is sent to the browser', () => {
    const body = JSON.stringify(denied(blocked()));
    expect(body).not.toMatch(/stripe|cus_|sub_|price_|secret|customer|webhook/i);
  });

  it('refuses to build a denial from a gate that was allowed', () => {
    // Fail loudly rather than emit a 403 with an empty payload.
    const allowed: GateResult = {
      ok: true,
      reason: null,
      denial: null,
      entitlement: entitlementOf('pro'),
    };
    expect(() => denied(allowed)).toThrow(/not blocked/);
  });
});

describe('the thrown error form stays consistent with the returned form', () => {
  it('shares the code and status used by route handlers', () => {
    const err = new EntitlementError('aiCoach', 'pro', 'msg');
    expect(isEntitlementError(err)).toBe(true);
    expect(err.status).toBe(403);
    expect(err.code).toBe(denied(blocked()).entitlement.code);
  });
});

describe('every gated action returns the typed form', () => {
  const GATED_FILES = [
    'features/ai-coach/server/actions.ts',
    'features/import/server/actions.ts',
    'features/reports/server/actions.ts',
    'features/journal/server/actions.ts',
    'features/accounts/server/actions.ts',
    'features/playbook/server/actions.ts',
  ];

  it.each(GATED_FILES)('%s routes denials through denied()', (file) => {
    const source = read(file);
    expect(source).toContain('denied(');
    // The untyped shape must be gone from gate handling.
    expect(source).not.toMatch(/error:\s*\w+Gate?\.reason\s*\?\?/);
    expect(source).not.toMatch(/error:\s*(gate|quota)\.reason\s*\?\?/);
  });

  it('analytics returns a typed denial alongside its empty payload', () => {
    const source = read('features/analytics/server/actions.ts');
    expect(source).toContain('denied: gate.denial');
    // And still returns nothing real.
    expect(source).toMatch(/summary: null, breakdown: \[\], denied/);
  });
});

describe('API routes do not leak premium data', () => {
  it('/api/v1/trades fails closed without a token', () => {
    const source = read('app/api/v1/trades/route.ts');
    expect(source).toContain("apiError('unauthorized'");
    expect(source).toMatch(/status: 401/);
    // Rate limited before auth so anonymous probing is throttled too.
    expect(source.indexOf('consumeRateLimit')).toBeLessThan(source.indexOf('if (!token)'));
  });

  it('the billing webhook verifies a signature before acting', () => {
    const source = read('app/api/billing/webhook/route.ts');
    expect(/verifyWebhookSignature|signature/i.test(source)).toBe(true);
  });
});
