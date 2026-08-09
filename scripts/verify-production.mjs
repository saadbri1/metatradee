#!/usr/bin/env node
/**
 * Prove that the production domain is serving the commit at local HEAD.
 *
 * THIS EXISTS BECAUSE "READY AND NEWEST" IS NOT EVIDENCE. An older commit can be
 * redeployed at any time — from the dashboard, from a rollback, from a promote —
 * and the result is a Production deployment on branch `main`, with target
 * `production`, in state READY, created after the deployment you were waiting
 * for, carrying the *previous* commit. Every attribute a naive wait-loop checks
 * is satisfied by that deployment. Only the Git SHA is not, which is why the SHA
 * is the only thing this script selects on.
 *
 * The chain it establishes, end to end:
 *
 *   local HEAD == origin/main
 *     == meta.githubCommitSha of exactly one chosen Production deployment
 *     == a deployment in state READY
 *     == the deployment the production domain is aliased to
 *     == the build whose asset hashes the production domain actually serves
 *
 * Any broken link exits non-zero. There is no flag that skips a link.
 *
 * Usage:
 *   pnpm verify:production                 check once, now
 *   pnpm verify:production --wait          poll until HEAD is live (after a push)
 *   pnpm verify:production --wait --timeout=1200 --path=/pricing
 *
 * Credentials: reuses the Vercel CLI login, or VERCEL_TOKEN. The token is read,
 * never printed, and never written anywhere. API error bodies are not echoed —
 * only the HTTP status and Vercel's own error code.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const API = 'https://api.vercel.com';

/** A full 40-hex commit. Abbreviations are refused: a prefix match is not a match. */
export const FULL_SHA = /^[0-9a-f]{40}$/;

/** States from which a deployment can still become READY. */
const PENDING_STATES = new Set(['QUEUED', 'INITIALIZING', 'BUILDING']);
/** States from which it never will. */
const DEAD_STATES = new Set(['ERROR', 'CANCELED', 'DELETED']);

// ─────────────────────────────────────────────────────────────────────────────
// Pure selection logic. Exported and unit-tested — this is the part that was
// wrong before, so it is the part that is pinned by tests rather than by care.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every Production deployment built from exactly `expectedSha`.
 *
 * Deliberately returns *all* matches rather than one: a commit can legitimately
 * be deployed more than once, and picking "the newest" even among correct
 * matches would reintroduce ordering as a selection criterion.
 */
export function selectDeploymentsForSha(deployments, expectedSha) {
  if (!FULL_SHA.test(expectedSha)) {
    throw new Error(`Expected a full 40-character commit SHA, got: ${expectedSha}`);
  }
  return deployments.filter((d) => {
    if (d?.target !== 'production') return false;
    const sha = d?.meta?.githubCommitSha;
    return typeof sha === 'string' && sha.toLowerCase() === expectedSha;
  });
}

/** Vercel spells the state two ways depending on the endpoint. */
export function stateOf(deployment) {
  return deployment?.state ?? deployment?.readyState ?? 'UNKNOWN';
}

/**
 * And it spells the id two ways too: the list endpoint returns `uid`, the detail
 * endpoint returns `id`. Reading only one of them printed `deployment undefined`
 * in the first run of this script — harmless there, but the id is the thing a
 * human uses to check the claim, so it must not be able to go missing quietly.
 */
export function idOf(deployment) {
  return deployment?.id ?? deployment?.uid ?? null;
}

/**
 * The one deployment to verify against, from the SHA-matched set.
 *
 * `servingId` comes from the alias endpoint — the deployment the domain points
 * at *right now*. It must not come from a deployment's own `alias` array: that
 * field is a record of aliases a deployment once held and is NOT cleared when
 * the alias moves on. Measured on this project, a superseded deployment still
 * listed `www.metatradee.com` with `aliasAssigned: true` while the domain was
 * being served by a different deployment entirely. Trusting it would have made
 * "the domain points at this build" a claim that is true of two builds at once.
 *
 * Preference order, none of which is recency: the deployment currently serving
 * the domain, then any READY one, then nothing. Matches that are still building
 * are "not live yet", not candidates.
 */
export function chooseVerifiableDeployment(matches, servingId) {
  const ready = matches.filter((d) => stateOf(d) === 'READY');
  const serving = ready.find((d) => idOf(d) === servingId);
  return serving ?? ready[0] ?? null;
}

/**
 * The project's canonical production host.
 *
 * Excludes `*.vercel.app` (a platform hostname, not the product's address) and
 * anything configured as a redirect — `metatradee.com` redirects to `www`, and
 * verifying the redirect source would prove nothing about what it lands on.
 */
export function chooseProductionDomain(domains) {
  const candidates = (domains ?? []).filter(
    (d) =>
      d?.verified && !d.redirect && typeof d.name === 'string' && !d.name.endsWith('.vercel.app'),
  );
  if (candidates.length === 0) return null;
  // Shortest wins only to make the choice deterministic when a project has
  // several apex-equal hosts; it is never used to prefer one build over another.
  return candidates.map((d) => d.name).sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
}

/**
 * Build fingerprint: the set of hashed asset paths a page references.
 *
 * These filenames contain content hashes produced by the build, so two hosts
 * emitting the same set are serving the same build. Comparing whole documents
 * instead would be brittle — anything host-dependent in the markup (a canonical
 * URL, an absolute OG tag) differs legitimately between the domain and the
 * deployment's own hostname.
 */
export function buildFingerprint(html) {
  const found = html.match(/\/_next\/static\/[a-zA-Z0-9._\-/]+/g) ?? [];
  return [...new Set(found)].sort();
}

export function fingerprintsMatch(a, b) {
  return a.length > 0 && a.length === b.length && a.every((v, i) => v === b[i]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Environment: git, credentials, project identity. Nothing here is hardcoded.
// ─────────────────────────────────────────────────────────────────────────────

function fail(message, hint) {
  console.error(`\n✖ ${message}`);
  if (hint) console.error(`  ${hint}`);
  process.exit(1);
}

function git(...args) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    fail(`git ${args.join(' ')} failed.`, String(error.stderr || error.message || error).trim());
  }
}

/**
 * The Vercel CLI's own credential store, or VERCEL_TOKEN for CI.
 *
 * Returned so it can be put in an Authorization header and nowhere else. It is
 * never logged, never included in an error, and never written to disk.
 */
function readVercelToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;

  const dirs = [];
  if (process.env.XDG_DATA_HOME) dirs.push(process.env.XDG_DATA_HOME);
  if (platform() === 'darwin') dirs.push(join(homedir(), 'Library', 'Application Support'));
  if (platform() === 'win32' && process.env.APPDATA) dirs.push(process.env.APPDATA);
  dirs.push(join(homedir(), '.local', 'share'));

  for (const dir of dirs) {
    try {
      const raw = readFileSync(join(dir, 'com.vercel.cli', 'auth.json'), 'utf8');
      const token = JSON.parse(raw)?.token;
      if (typeof token === 'string' && token.length > 0) return token;
    } catch {
      // Try the next location. A missing or unreadable store is not an error
      // until every location has been tried.
    }
  }

  return fail(
    'No Vercel credentials found.',
    'Run `npx vercel login`, or set VERCEL_TOKEN in the environment.',
  );
}

/** Project identity from the CLI link, or the standard CI variables. */
function readProjectIdentity() {
  const fromEnv = {
    projectId: process.env.VERCEL_PROJECT_ID,
    teamId: process.env.VERCEL_ORG_ID,
  };
  if (fromEnv.projectId && fromEnv.teamId) return fromEnv;

  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), '.vercel', 'project.json'), 'utf8'));
    if (raw?.projectId && raw?.orgId) return { projectId: raw.projectId, teamId: raw.orgId };
  } catch {
    // Fall through to the shared error below. `.vercel/` is gitignored, so a
    // fresh clone and CI both land here legitimately.
  }

  return fail(
    'Could not determine the Vercel project.',
    'Run `npx vercel link`, or set VERCEL_PROJECT_ID and VERCEL_ORG_ID.',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// API and HTTP
// ─────────────────────────────────────────────────────────────────────────────

async function api(path, token) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    // Status and Vercel's own error code only. The body can carry project and
    // account detail that has no business in a terminal or a CI log.
    let code = 'unknown';
    try {
      code = (await res.json())?.error?.code ?? 'unknown';
    } catch {
      /* non-JSON error body — the status is enough */
    }
    fail(`Vercel API request failed (HTTP ${res.status}, code: ${code}).`);
  }
  return res.json();
}

/**
 * Production deployments, newest first, paginated.
 *
 * The page depth matters for correctness, not speed: if the expected commit is
 * older than the window we read, the script would wrongly report it as never
 * deployed. Three pages is 300 production deployments.
 */
async function listProductionDeployments({ projectId, teamId }, token, pages = 3) {
  const all = [];
  let until;
  for (let i = 0; i < pages; i++) {
    const query = new URLSearchParams({
      projectId,
      teamId,
      target: 'production',
      limit: '100',
    });
    if (until) query.set('until', String(until));
    const page = await api(`/v6/deployments?${query}`, token);
    all.push(...(page.deployments ?? []));
    until = page.pagination?.next;
    if (!until) break;
  }
  return all;
}

/** Deployment detail, for the final state and the deployment's own hostname. */
function getDeployment(uid, teamId, token) {
  return api(`/v13/deployments/${uid}?teamId=${encodeURIComponent(teamId)}`, token);
}

/**
 * The deployment a domain is pointing at *now* — the authoritative answer.
 *
 * This endpoint is queried from the alias side deliberately. Asking a deployment
 * which aliases it holds gets a stale answer: superseded deployments keep the
 * alias in their `alias` array with `aliasAssigned: true` long after the domain
 * has moved to a newer build.
 */
async function getServingDeploymentId(domain, teamId, token) {
  const alias = await api(
    `/v4/aliases/${encodeURIComponent(domain)}?teamId=${encodeURIComponent(teamId)}`,
    token,
  );
  return alias?.deploymentId ?? null;
}

async function getPage(url) {
  const headers = {};
  // The official way past Deployment Protection. Read, used as a header, never
  // printed — same handling as the API token.
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }
  const res = await fetch(url, {
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  return { status: res.status, body: await res.text() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Steps
// ─────────────────────────────────────────────────────────────────────────────

function readGitState({ fetchRemote }) {
  const head = git('rev-parse', 'HEAD').toLowerCase();
  if (fetchRemote) git('fetch', 'origin', 'main', '--quiet');
  const remote = git('rev-parse', 'origin/main').toLowerCase();

  console.log(`  local HEAD    ${head}`);
  console.log(`  origin/main   ${remote}`);

  if (head !== remote) {
    fail(
      'Local HEAD does not match origin/main.',
      'Push (or pull) first — Production can only ever serve what the remote has.',
    );
  }
  if (!FULL_SHA.test(head)) fail(`HEAD is not a full commit SHA: ${head}`);
  return head;
}

/**
 * The SHA-matched, READY deployment — waiting for it if asked to.
 *
 * Waiting is a loop around the *same* selection, never a relaxation of it: a
 * timeout is reported as "not deployed", which is the honest answer.
 */
async function resolveDeployment({ expectedSha, identity, token, domain, wait, timeoutMs }) {
  const deadline = Date.now() + timeoutMs;
  const pollMs = 15_000;

  for (;;) {
    const [deployments, servingId] = await Promise.all([
      listProductionDeployments(identity, token),
      // Re-read every poll: promoting a deployment is exactly what we are
      // waiting for, so this is the value that changes.
      getServingDeploymentId(domain, identity.teamId, token),
    ]);
    const matches = selectDeploymentsForSha(deployments, expectedSha);

    if (matches.length > 0) {
      const dead = matches.filter((d) => DEAD_STATES.has(stateOf(d)));
      const live = matches.filter((d) => !DEAD_STATES.has(stateOf(d)));

      if (live.length === 0) {
        fail(
          `The expected commit was deployed but did not build: ${dead.map(stateOf).join(', ')}.`,
          `Deployment ${idOf(dead[0])} — check its build logs.`,
        );
      }

      const chosen = chooseVerifiableDeployment(live, servingId);
      if (chosen) return { deployment: chosen, servingId };

      const pending = live.filter((d) => PENDING_STATES.has(stateOf(d)));
      if (!wait) {
        fail(
          `The expected commit is deploying but is not READY (${pending.map(stateOf).join(', ')}).`,
          'Re-run with --wait to block until it is.',
        );
      }
    } else if (!wait) {
      fail(
        'Expected commit has not been deployed to Production yet.',
        `No Production deployment carries ${expectedSha}. Being newer than the last one is not the same thing.`,
      );
    }

    if (Date.now() >= deadline) {
      fail(
        matches.length === 0
          ? 'Expected commit has not been deployed to Production yet.'
          : 'Timed out waiting for the expected commit to reach READY.',
        `Waited ${Math.round(timeoutMs / 1000)}s for ${expectedSha}.`,
      );
    }
    process.stdout.write('  …waiting for the expected commit to reach READY\n');
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

/** The domain points at this deployment, and serves this deployment's build. */
async function verifyDomain({ domain, deployment, servingId, path }) {
  if (servingId !== idOf(deployment)) {
    fail(
      `${domain} is not pointing at deployment ${idOf(deployment)}.`,
      servingId
        ? `It is currently served by ${servingId}. The expected commit is built and READY but is not the live one — promote or redeploy it.`
        : 'The domain resolves to no deployment at all.',
    );
  }
  console.log(`  serving alias ${domain} → ${servingId}`);

  const domainUrl = `https://${domain}${path}`;
  const deployUrl = `https://${deployment.url}${path}`;
  const [live, origin] = await Promise.all([getPage(domainUrl), getPage(deployUrl)]);

  if (live.status !== 200) fail(`${domainUrl} returned HTTP ${live.status}, expected 200.`);
  if (origin.status !== 200) {
    fail(
      `${deployUrl} returned HTTP ${origin.status}, expected 200.`,
      origin.status === 401
        ? 'Deployment Protection is on. Set VERCEL_AUTOMATION_BYPASS_SECRET so this check can run.'
        : undefined,
    );
  }

  const livePrint = buildFingerprint(live.body);
  const originPrint = buildFingerprint(origin.body);
  if (livePrint.length === 0) {
    fail(
      `No hashed build assets found on ${domainUrl}, so the build cannot be fingerprinted.`,
      'Pick a different page with --path=/some-page.',
    );
  }
  if (!fingerprintsMatch(livePrint, originPrint)) {
    const shared = livePrint.filter((asset) => originPrint.includes(asset)).length;
    fail(
      `${domain} is serving a different build than deployment ${idOf(deployment)}.`,
      `${shared} of ${livePrint.length} asset hashes on the domain also appear on the deployment.`,
    );
  }

  const identical = sha256(live.body) === sha256(origin.body);
  console.log(`  build         ${path} — ${livePrint.length} asset hashes match`);
  console.log(
    `  document      ${identical ? 'byte-identical' : 'equivalent build, host-specific markup'}`,
  );
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const flag = (name) => argv.includes(`--${name}`);
  const value = (name, fallback) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : fallback;
  };
  return {
    wait: flag('wait'),
    fetchRemote: !flag('no-fetch'),
    timeoutMs: Number(value('timeout', '900')) * 1000,
    path: value('path', '/'),
  };
}

async function main(argv) {
  const options = parseArgs(argv);
  const token = readVercelToken();
  const identity = readProjectIdentity();

  console.log('\nProduction verification — selection is by Git SHA, never by recency.\n');

  const expectedSha = readGitState(options);

  const domains = await api(
    `/v9/projects/${encodeURIComponent(identity.projectId)}/domains?teamId=${encodeURIComponent(identity.teamId)}&production=true&limit=100`,
    token,
  );
  const domain = chooseProductionDomain(domains.domains);
  if (!domain) fail('No verified, non-redirecting production domain is attached to this project.');
  console.log(`  domain        ${domain}`);

  const { deployment: summary, servingId } = await resolveDeployment({
    ...options,
    expectedSha,
    identity,
    token,
    domain,
  });
  const deployment = await getDeployment(idOf(summary), identity.teamId, token);

  const deployedSha = deployment?.meta?.githubCommitSha?.toLowerCase();
  // Re-read from the detail endpoint rather than trusting the list entry, so the
  // object we verify against is the object we assert about.
  if (deployedSha !== expectedSha) {
    fail(`Deployment ${idOf(deployment)} reports ${deployedSha}, expected ${expectedSha}.`);
  }
  if (stateOf(deployment) !== 'READY') {
    fail(`Deployment ${idOf(deployment)} is ${stateOf(deployment)}, expected READY.`);
  }

  console.log(`  deployment    ${idOf(deployment)}`);
  console.log(`  commit        ${deployedSha}`);
  console.log(`  state         ${stateOf(deployment)}`);

  await verifyDomain({ domain, deployment, servingId, path: options.path });

  console.log(`\n✓ https://${domain} is serving ${expectedSha}\n`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  await main(process.argv.slice(2));
}
