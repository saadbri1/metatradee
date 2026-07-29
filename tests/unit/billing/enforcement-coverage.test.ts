/**
 * Enforcement COVERAGE.
 *
 * The audit found four numeric limits declared in the plan matrix but enforced
 * nowhere (accounts, playbooks, reports/month, AI reviews/month), and the
 * analytics server actions returning the advanced payload to any signed-in
 * caller even though the /analytics page was guarded.
 *
 * These tests read the real source files, so a limit or capability cannot be
 * declared without a gate that actually references it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PLANS, type PlanLimits } from '@/features/billing/plans';

const SRC = resolve(__dirname, '../../../src');
const read = (p: string) => readFileSync(resolve(SRC, p), 'utf8');

/** Every limit key → the action file that must enforce it. */
const LIMIT_ENFORCERS: Record<keyof PlanLimits, string> = {
  maxTrades: 'features/journal/server/actions.ts',
  maxAccounts: 'features/accounts/server/actions.ts',
  maxStrategies: 'features/playbook/server/actions.ts',
  maxReportsPerMonth: 'features/reports/server/actions.ts',
  aiReviewsPerMonth: 'features/ai-coach/server/actions.ts',
};

/** Every gated capability → the server file that must enforce it. */
const FEATURE_ENFORCERS: { feature: string; file: string }[] = [
  { feature: 'aiCoach', file: 'features/ai-coach/server/actions.ts' },
  { feature: 'brokerImport', file: 'features/import/server/actions.ts' },
  { feature: 'advancedAnalytics', file: 'features/analytics/server/actions.ts' },
  { feature: 'reportsExport', file: 'features/reports/server/actions.ts' },
  { feature: 'reportSharing', file: 'features/reports/server/actions.ts' },
];

describe('every declared numeric limit is enforced by a server gate', () => {
  it('covers every key in PlanLimits — no limit may be declared without an enforcer', () => {
    const declared = Object.keys(PLANS.free.limits).sort();
    expect(Object.keys(LIMIT_ENFORCERS).sort()).toEqual(declared);
  });

  it.each(Object.entries(LIMIT_ENFORCERS))('%s is enforced in %s', (key, file) => {
    expect(existsSync(resolve(SRC, file)), `${file} must exist`).toBe(true);
    const source = read(file);
    expect(source, `${file} must reference '${key}'`).toContain(`'${key}'`);
    expect(/assertWithinLimit|assertCanAdd/.test(source), `${file} must call a limit gate`).toBe(
      true,
    );
  });
});

describe('every gated capability is enforced on the server', () => {
  it.each(FEATURE_ENFORCERS)('$feature is enforced in $file', ({ feature, file }) => {
    const source = read(file);
    expect(source).toContain(`'${feature}'`);
    expect(/assertFeature|requireFeature/.test(source)).toBe(true);
  });

  it('analytics gates the ACTION, not just the page', () => {
    // The page guard alone was bypassable: a server action is directly
    // invocable, and both analytics actions returned the full payload.
    const source = read('features/analytics/server/actions.ts');
    const actions = source.match(/export async function \w+/g) ?? [];
    expect(actions.length).toBeGreaterThan(0);
    const gates = source.match(/assertFeature\(/g) ?? [];
    expect(gates.length, 'every exported analytics action needs a gate').toBe(actions.length);
  });
});

/**
 * Ordering must be checked INSIDE the function that does the work — comparing
 * whole-file offsets matches import statements and top-level constants, which
 * says nothing about the call site.
 */
function bodyOf(source: string, fnName: string): string {
  const start = source.indexOf(`export async function ${fnName}`);
  if (start === -1) throw new Error(`${fnName} not found`);
  const next = source.indexOf('\nexport async function ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

describe('gates run before the work they protect', () => {
  it('the AI review quota is checked before the review is built', () => {
    // A refused request must not reach the provider or spend credit.
    const body = bodyOf(read('features/ai-coach/server/actions.ts'), 'generateReviewAction');
    const quota = body.indexOf("'aiReviewsPerMonth'");
    const work = body.indexOf('buildReview(');
    expect(quota, 'quota gate must be present in generateReviewAction').toBeGreaterThan(-1);
    expect(work, 'buildReview must be called in generateReviewAction').toBeGreaterThan(-1);
    expect(quota).toBeLessThan(work);
  });

  it('the AI feature gate precedes the quota check', () => {
    const body = bodyOf(read('features/ai-coach/server/actions.ts'), 'generateReviewAction');
    expect(body.indexOf("'aiCoach'")).toBeLessThan(body.indexOf("'aiReviewsPerMonth'"));
  });

  it('the account limit is checked before the row is inserted', () => {
    const body = bodyOf(read('features/accounts/server/actions.ts'), 'createTradingAccountAction');
    expect(body.indexOf("'maxAccounts'")).toBeLessThan(body.indexOf('.insert('));
  });

  it('the playbook limit is checked before the row is inserted', () => {
    const body = bodyOf(read('features/playbook/server/actions.ts'), 'createStrategyAction');
    expect(body.indexOf("'maxStrategies'")).toBeLessThan(body.indexOf('.insert('));
  });

  it('the monthly report limit is checked before the row is inserted', () => {
    const body = bodyOf(read('features/reports/server/actions.ts'), 'createReportAction');
    expect(body.indexOf("'maxReportsPerMonth'")).toBeLessThan(body.indexOf('.insert('));
  });
});

describe('the limit gate fails closed', () => {
  it('refuses when the usage count cannot be read', () => {
    // An unknown count must not be treated as zero.
    const source = read('features/billing/server/enforce.ts');
    expect(source).toMatch(/if \(error\)[\s\S]{0,160}ok: false/);
  });
});
