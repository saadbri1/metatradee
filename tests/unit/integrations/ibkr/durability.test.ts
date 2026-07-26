import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Durability and caching guarantees for the IBKR Flex connection check.
 *
 * These lock the behaviours that failed in Preview: a byte-identical
 * `report_pending` returned for 45 minutes because the pending reference lived
 * only in process memory and every request re-issued `/SendRequest`.
 */
vi.mock('server-only', () => ({}));

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkFlexConnection } from '@/features/integrations/ibkr/connection-check';
import {
  memoryStore,
  databaseStore,
  sessionKey,
  fingerprint,
  __resetMemoryStore,
  SESSION_TTL_MS,
  type ReportSession,
  type ReportSessionStore,
} from '@/features/integrations/ibkr/store';
import { staticFlexCredentialSource } from '@/features/integrations/ibkr/credentials';
import { __resetSessions } from '@/features/integrations/ibkr/session';

const CREDS = { token: 'TEST_TOKEN_NOT_REAL_000111222', queryId: 'TEST_QUERY_9999' };
const source = staticFlexCredentialSource(CREDS);

const SEND_OK = `<FlexStatementResponse><Status>Success</Status><ReferenceCode>REF-ABC-123</ReferenceCode></FlexStatementResponse>`;
const PENDING = `<FlexStatementResponse><Status>Warn</Status><ErrorCode>1019</ErrorCode><ErrorMessage>Statement generation in progress.</ErrorMessage></FlexStatementResponse>`;
const STATEMENT_EMPTY = `<FlexQueryResponse queryName="MetaTradee Activity"><FlexStatements count="1"><FlexStatement accountId="DU5551234" fromDate="20260701" toDate="20260726"><Trades></Trades></FlexStatement></FlexStatements></FlexQueryResponse>`;

function fetchSequence(bodies: string[]) {
  const calls: string[] = [];
  const impl = vi.fn(async (url: URL | RequestInfo) => {
    calls.push(String(url));
    return { ok: true, status: 200, text: async () => bodies.shift() ?? '' } as unknown as Response;
  });
  return { impl, calls };
}

const noSleep = vi.fn(async () => {});
const endpoints = (calls: string[]) =>
  calls.map((u) => (u.includes('/SendRequest') ? 'SendRequest' : 'GetStatement'));

/**
 * A store SHARED between two simulated serverless instances. Each instance gets
 * its own wrapper object — as it would in production — but they read and write
 * the same underlying rows.
 */
function sharedStore(): {
  forInstance: () => ReportSessionStore;
  rows: Map<string, ReportSession>;
} {
  const rows = new Map<string, ReportSession>();
  const id = (k: { credentialFingerprint: string; queryFingerprint: string }) =>
    `${k.credentialFingerprint}:${k.queryFingerprint}`;

  const forInstance = (): ReportSessionStore => ({
    kind: 'database',
    async getPending(key) {
      const row = rows.get(id(key));
      if (!row || row.status !== 'pending') return null;
      // Expired rows are still returned — expiry is the caller's decision, and
      // this double must honour the same contract as the real store.
      return { ...row };
    },
    async upsertPending(key, session) {
      rows.set(id(key), { ...session });
    },
    async close(key, status, category, now) {
      const row = rows.get(id(key));
      if (row)
        rows.set(id(key), { ...row, status, terminalErrorCategory: category, lastCheckedAt: now });
    },
  });

  return { forInstance, rows };
}

beforeEach(() => {
  __resetSessions();
  __resetMemoryStore();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------

describe('cross-instance durability', () => {
  it('a SECOND serverless instance reuses the persisted ReferenceCode', async () => {
    const shared = sharedStore();
    const { impl, calls } = fetchSequence([SEND_OK, PENDING, STATEMENT_EMPTY]);
    let clock = 1_000_000;

    // Instance A: starts the report, gets pending.
    const a = await checkFlexConnection({
      credentialSource: source,
      store: shared.forInstance(),
      fetchImpl: impl,
      sleep: noSleep,
      random: () => 0.5,
      now: () => clock,
    });
    expect(a.category).toBe('report_pending');
    expect(a.referenceReused).toBe(true);

    // Instance B is a completely separate store object with no memory of A.
    clock += 120_000;
    const b = await checkFlexConnection({
      credentialSource: source,
      store: shared.forInstance(),
      fetchImpl: impl,
      sleep: noSleep,
      random: () => 0.5,
      now: () => clock,
    });

    expect(b.ok).toBe(true);
    // THE POINT: SendRequest ran exactly once, across two instances.
    expect(endpoints(calls).filter((e) => e === 'SendRequest')).toHaveLength(1);
    // And instance B polled the SAME persisted reference.
    const statementCalls = calls.filter((u) => u.includes('/GetStatement'));
    expect(statementCalls).toHaveLength(2);
    for (const url of statementCalls) expect(url).toContain('q=REF-ABC-123');
  });

  it('persists a session even when SendRequest itself answers pending', async () => {
    // This is the exact Preview failure: the pending came from the SendRequest
    // leg, so no reference existed and every call re-sent it.
    const shared = sharedStore();
    const { impl, calls } = fetchSequence([PENDING, PENDING, PENDING]);
    let clock = 2_000_000;

    const first = await checkFlexConnection({
      credentialSource: source,
      store: shared.forInstance(),
      fetchImpl: impl,
      sleep: noSleep,
      random: () => 0.5,
      now: () => clock,
    });
    expect(first.category).toBe('report_pending');
    expect(first.stage).toBe('send_request');

    // Three rapid refreshes inside the backoff, on a fresh instance each time.
    clock += 100;
    for (let i = 0; i < 3; i += 1) {
      const again = await checkFlexConnection({
        credentialSource: source,
        store: shared.forInstance(),
        fetchImpl: impl,
        sleep: noSleep,
        random: () => 0.5,
        now: () => clock,
      });
      expect(again.category).toBe('report_pending');
      expect(again.referenceReused).toBe(true);
    }

    // Only the very first call reached IBKR.
    expect(calls).toHaveLength(1);
  });

  it('enforces one active report per credential + query fingerprint', () => {
    const a = sessionKey(CREDS.token, CREDS.queryId);
    const b = sessionKey(CREDS.token, 'A_DIFFERENT_QUERY');
    const c = sessionKey('A_DIFFERENT_TOKEN', CREDS.queryId);

    // Same credential, different query → a different session.
    expect(a.credentialFingerprint).toBe(b.credentialFingerprint);
    expect(a.queryFingerprint).not.toBe(b.queryFingerprint);
    // Different credential → a different session.
    expect(a.credentialFingerprint).not.toBe(c.credentialFingerprint);
  });

  it('never stores the token or query id — only one-way fingerprints', () => {
    const key = sessionKey(CREDS.token, CREDS.queryId);
    const serialized = JSON.stringify(key);

    expect(serialized).not.toContain(CREDS.token);
    expect(serialized).not.toContain(CREDS.queryId);
    // Deterministic, and not reversible.
    expect(sessionKey(CREDS.token, CREDS.queryId)).toEqual(key);
    expect(fingerprint('x', 'salt')).not.toBe(fingerprint('x', 'other-salt'));
  });
});

describe('freshness — no response can be a cached copy', () => {
  it('changes responseGeneratedAt and referenceAgeSeconds between calls', async () => {
    const shared = sharedStore();
    const { impl } = fetchSequence([PENDING, PENDING, PENDING]);
    let clock = 3_000_000;
    const call = () =>
      checkFlexConnection({
        credentialSource: source,
        store: shared.forInstance(),
        fetchImpl: impl,
        sleep: noSleep,
        random: () => 0.5,
        now: () => clock,
      });

    const first = await call();
    clock += 5_000;
    const second = await call();

    // Two responses can never be byte-identical: the timestamp moves...
    expect(second.responseGeneratedAt).not.toBe(first.responseGeneratedAt);
    // ...and the report visibly ages.
    expect(second.referenceAgeSeconds!).toBeGreaterThan(first.referenceAgeSeconds!);
    expect(JSON.stringify(second)).not.toBe(JSON.stringify(first));
  });

  it('reports the store actually in use, never claiming durability it lacks', async () => {
    const { impl } = fetchSequence([PENDING]);
    const result = await checkFlexConnection({
      credentialSource: source,
      store: memoryStore(),
      fetchImpl: impl,
      sleep: noSleep,
      random: () => 0.5,
    });
    expect(result.stateStore).toBe('memory');

    const shared = sharedStore();
    const { impl: impl2 } = fetchSequence([PENDING]);
    const durable = await checkFlexConnection({
      credentialSource: source,
      store: shared.forInstance(),
      fetchImpl: impl2,
      sleep: noSleep,
      random: () => 0.5,
    });
    expect(durable.stateStore).toBe('database');
  });
});

describe('hard pending timeout', () => {
  it('stops returning report_pending forever and explains what to check', async () => {
    const shared = sharedStore();
    const { impl, calls } = fetchSequence([PENDING]);
    let clock = 4_000_000;

    await checkFlexConnection({
      credentialSource: source,
      store: shared.forInstance(),
      fetchImpl: impl,
      sleep: noSleep,
      random: () => 0.5,
      now: () => clock,
    });

    // Well past the session TTL.
    clock += SESSION_TTL_MS + 60_000;
    const timedOut = await checkFlexConnection({
      credentialSource: source,
      store: shared.forInstance(),
      fetchImpl: impl,
      sleep: noSleep,
      random: () => 0.5,
      now: () => clock,
    });

    expect(timedOut.category).toBe('report_timeout');
    expect(timedOut.message).toMatch(/verify the saved flex query/i);
    // It did not keep hammering IBKR to discover that.
    expect(calls).toHaveLength(1);
  });
});

describe('route caching configuration', () => {
  const routeSource = readFileSync(
    resolve(__dirname, '../../../../src/app/api/integrations/ibkr/flex/connection-check/route.ts'),
    'utf8',
  );

  it('disables every layer of caching', () => {
    expect(routeSource).toMatch(/export const dynamic = 'force-dynamic'/);
    expect(routeSource).toMatch(/export const revalidate = 0/);
    expect(routeSource).toMatch(/'private, no-store, no-cache, max-age=0, must-revalidate'/);
    expect(routeSource).toMatch(/pragma: 'no-cache'/);
    expect(routeSource).toMatch(/expires: '0'/);
    // Vercel's CDN honours these specifically.
    expect(routeSource).toMatch(/cdn-cache-control/);
  });

  it('applies the no-store headers to every response path', () => {
    // 404, 401 and the success path all send NO_STORE_HEADERS.
    const uses = routeSource.match(/NO_STORE_HEADERS/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(4); // definition + 3 responses
  });
});

describe('response safety', () => {
  it('never returns the ReferenceCode, token, query id or a full account id', async () => {
    const shared = sharedStore();
    const { impl } = fetchSequence([SEND_OK, STATEMENT_EMPTY]);
    const result = await checkFlexConnection({
      credentialSource: source,
      store: shared.forInstance(),
      fetchImpl: impl,
      sleep: noSleep,
      random: () => 0.5,
    });

    const serialized = JSON.stringify(result);
    expect(result.ok).toBe(true);
    expect(serialized).not.toContain('REF-ABC-123'); // the ReferenceCode
    expect(serialized).not.toContain(CREDS.token);
    expect(serialized).not.toContain(CREDS.queryId);
    expect(serialized).not.toContain('DU5551234'); // full account id
    expect(serialized).not.toContain('<FlexQueryResponse');
    expect(result.account).toBe('DU•••••34');
  });

  it('succeeds on a valid empty report with zero trades', async () => {
    const shared = sharedStore();
    const { impl } = fetchSequence([SEND_OK, STATEMENT_EMPTY]);
    const result = await checkFlexConnection({
      credentialSource: source,
      store: shared.forInstance(),
      fetchImpl: impl,
      sleep: noSleep,
      random: () => 0.5,
    });

    expect(result.ok).toBe(true);
    expect(result.tradeCount).toBe(0);
    expect(result.reportStatus).toBe('ready');
  });
});

describe('database store shape', () => {
  it('writes no secret and keys rows by fingerprint only', async () => {
    const writes: Record<string, unknown>[] = [];
    const fakeClient = {
      from: () => ({
        select: () => ({
          match: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
        upsert: async (row: Record<string, unknown>) => {
          writes.push(row);
          return { error: null };
        },
        update: () => ({ match: async () => ({ error: null }) }),
      }),
    } as unknown as Parameters<typeof databaseStore>[0];

    const store = databaseStore(fakeClient);
    const key = sessionKey(CREDS.token, CREDS.queryId);
    await store.upsertPending(key, {
      referenceCode: 'REF-ABC-123',
      status: 'pending',
      attempts: 1,
      createdAt: Date.now(),
      lastCheckedAt: null,
      nextAllowedCheckAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS,
      terminalErrorCategory: null,
    });

    const row = JSON.stringify(writes[0]);
    expect(row).not.toContain(CREDS.token);
    expect(row).not.toContain(CREDS.queryId);
    expect(writes[0]!.credential_fingerprint).toBe(key.credentialFingerprint);
    expect(writes[0]!.provider).toBe('ibkr-flex');
  });
});
