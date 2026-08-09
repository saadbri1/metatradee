/**
 * The production-verification selector.
 *
 * THIS IS A REGRESSION SUITE FOR A REAL INCIDENT. A wait-loop once accepted "a
 * READY Production deployment on main, newer than the last one" as proof that a
 * push was live. It locked onto a redeploy of the *previous* commit — every one
 * of those attributes was true of it — and reported Production as current while
 * the domain still 404'd the new routes.
 *
 * So the fixture below is that incident: a decoy that is newer, READY, on main,
 * targeting production, and built from the wrong commit. Every selection test
 * runs against it.
 */
import { describe, expect, it } from 'vitest';

import {
  buildFingerprint,
  chooseProductionDomain,
  chooseVerifiableDeployment,
  fingerprintsMatch,
  idOf,
  selectDeploymentsForSha,
  stateOf,
} from '../../../scripts/verify-production.mjs';

const EXPECTED = 'd1fea25c5403d7ab5689ebfaf61bbf38e04ec240';
const PREVIOUS = '7285677b31c3d42bd1149a03d131a08cbe57053a';
const DOMAIN = 'www.metatradee.com';

interface Fixture {
  uid: string;
  target?: string;
  state?: string;
  created: number;
  meta?: { githubCommitSha?: string; githubCommitRef?: string };
  alias?: string[];
}

const deployment = (over: Partial<Fixture> & { uid: string }): Fixture => ({
  target: 'production',
  state: 'READY',
  created: 1,
  meta: { githubCommitSha: EXPECTED, githubCommitRef: 'main' },
  alias: [],
  ...over,
});

/** The wanted commit, deployed first. The decoy, redeployed after it. */
const wanted = deployment({ uid: 'dpl_wanted', created: 100, alias: [DOMAIN] });
const decoy = deployment({
  uid: 'dpl_decoy_newer_wrong_commit',
  created: 999,
  meta: { githubCommitSha: PREVIOUS, githubCommitRef: 'main' },
});

describe('selectDeploymentsForSha', () => {
  it('ignores a newer READY production deployment built from another commit', () => {
    const picked = selectDeploymentsForSha([decoy, wanted], EXPECTED);
    expect(picked.map((d: Fixture) => d.uid)).toEqual(['dpl_wanted']);
  });

  it('finds nothing when only the previous commit is deployed, however recent', () => {
    expect(selectDeploymentsForSha([decoy], EXPECTED)).toEqual([]);
  });

  it('selects the oldest deployment when that is the one with the SHA', () => {
    const older = deployment({ uid: 'dpl_old', created: 1 });
    const newer = deployment({
      uid: 'dpl_new',
      created: 9_999,
      meta: { githubCommitSha: PREVIOUS },
    });
    expect(selectDeploymentsForSha([newer, older], EXPECTED).map((d: Fixture) => d.uid)).toEqual([
      'dpl_old',
    ]);
  });

  it('returns every deployment of the expected commit, not just one', () => {
    const twice = [wanted, deployment({ uid: 'dpl_redeploy', created: 500 })];
    expect(selectDeploymentsForSha(twice, EXPECTED)).toHaveLength(2);
  });

  it('refuses an abbreviated SHA rather than prefix-matching it', () => {
    expect(() => selectDeploymentsForSha([wanted], EXPECTED.slice(0, 7))).toThrow(/40-character/);
  });

  it('matches case-insensitively', () => {
    const upper = deployment({
      uid: 'dpl_upper',
      meta: { githubCommitSha: EXPECTED.toUpperCase() },
    });
    expect(selectDeploymentsForSha([upper], EXPECTED)).toHaveLength(1);
  });

  it('rejects a deployment with no commit metadata', () => {
    // A CLI deploy with no Git attribution cannot prove which commit it is.
    expect(selectDeploymentsForSha([deployment({ uid: 'dpl_cli', meta: {} })], EXPECTED)).toEqual(
      [],
    );
  });

  it('rejects a preview deployment even when its commit matches', () => {
    const preview = deployment({ uid: 'dpl_preview', target: 'preview' });
    expect(selectDeploymentsForSha([preview], EXPECTED)).toEqual([]);
  });
});

describe('chooseVerifiableDeployment', () => {
  it('prefers the deployment the domain is currently served by', () => {
    const other = deployment({ uid: 'dpl_other', created: 900 });
    expect(chooseVerifiableDeployment([other, wanted], 'dpl_wanted')?.uid).toBe('dpl_wanted');
  });

  it('ignores a deployment’s own stale alias list', () => {
    /*
     * Measured on this project: a superseded deployment still listed
     * `www.metatradee.com` in `alias` with `aliasAssigned: true` while the
     * domain was being served by a different deployment. The serving id comes
     * from the alias endpoint precisely so that claim cannot be true of two
     * builds at once — so a deployment that merely *claims* the alias loses to
     * the one the alias actually resolves to.
     */
    const stale = deployment({ uid: 'dpl_stale', created: 900, alias: [DOMAIN] });
    const live = deployment({ uid: 'dpl_live', created: 100, alias: [] });
    expect(chooseVerifiableDeployment([stale, live], 'dpl_live')?.uid).toBe('dpl_live');
  });

  it('returns nothing while the only matching deployment is still building', () => {
    const building = deployment({ uid: 'dpl_building', state: 'BUILDING' });
    expect(chooseVerifiableDeployment([building], 'dpl_building')).toBeNull();
  });

  it('does not treat a failed build as verifiable', () => {
    expect(chooseVerifiableDeployment([deployment({ uid: 'x', state: 'ERROR' })], 'x')).toBeNull();
  });

  it('reads the state under either of the two names Vercel uses', () => {
    expect(stateOf({ readyState: 'READY' })).toBe('READY');
    expect(stateOf({ state: 'BUILDING' })).toBe('BUILDING');
    expect(stateOf({})).toBe('UNKNOWN');
  });

  it('reads the id under either of the two names Vercel uses', () => {
    // The list endpoint says `uid`, the detail endpoint says `id`. Reading only
    // one printed "deployment undefined" — the id is what a human uses to check
    // the claim by hand, so it must not be able to vanish quietly.
    expect(idOf({ uid: 'dpl_from_list' })).toBe('dpl_from_list');
    expect(idOf({ id: 'dpl_from_detail' })).toBe('dpl_from_detail');
    expect(idOf({})).toBeNull();
  });
});

describe('chooseProductionDomain', () => {
  const domains = [
    { name: 'metatradee.com', verified: true, redirect: 'www.metatradee.com' },
    { name: 'www.metatradee.com', verified: true, redirect: null },
    { name: 'metatradee.vercel.app', verified: true, redirect: null },
  ];

  it('picks the canonical host, not the redirect source or the platform hostname', () => {
    expect(chooseProductionDomain(domains)).toBe('www.metatradee.com');
  });

  it('ignores an unverified domain', () => {
    const pending = [{ name: 'new.example.com', verified: false, redirect: null }];
    expect(chooseProductionDomain(pending)).toBeNull();
  });

  it('returns null when a project has only its vercel.app hostname', () => {
    expect(chooseProductionDomain([domains[2]])).toBeNull();
  });
});

describe('buildFingerprint', () => {
  const page = (hash: string) =>
    `<html><script src="/_next/static/chunks/main-${hash}.js"></script>` +
    `<link href="/_next/static/css/${hash}.css"/></html>`;

  it('treats two hosts serving the same build as a match', () => {
    expect(fingerprintsMatch(buildFingerprint(page('abc')), buildFingerprint(page('abc')))).toBe(
      true,
    );
  });

  it('catches a domain serving a different build than the deployment', () => {
    expect(fingerprintsMatch(buildFingerprint(page('abc')), buildFingerprint(page('def')))).toBe(
      false,
    );
  });

  it('never reports a match when there is nothing to fingerprint', () => {
    // Two asset-free pages are trivially "equal"; calling that proof would make
    // the whole check vacuous on any page that failed to render.
    expect(fingerprintsMatch(buildFingerprint('<html></html>'), buildFingerprint(''))).toBe(false);
  });

  it('de-duplicates and orders so markup order cannot fail a real match', () => {
    const a =
      '<script src="/_next/static/chunks/a.js"></script><script src="/_next/static/chunks/b.js"></script>';
    const b =
      '<script src="/_next/static/chunks/b.js"></script><script src="/_next/static/chunks/a.js"></script><script src="/_next/static/chunks/a.js"></script>';
    expect(fingerprintsMatch(buildFingerprint(a), buildFingerprint(b))).toBe(true);
  });
});
