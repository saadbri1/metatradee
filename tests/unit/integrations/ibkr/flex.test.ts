import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * IBKR Flex Phase 1 tests.
 *
 * FIXTURES ONLY — `fetch` is always injected, so the unit suite never makes a
 * real IBKR request and never consumes pacing budget against the live token.
 * The fake token below is a literal test string, not a credential.
 */
vi.mock('server-only', () => ({}));

import {
  parseSendRequest,
  parseStatement,
  parseFlexDateTime,
} from '@/features/integrations/ibkr/parse';
import {
  maskAccountId,
  classifyEnvironment,
  redactSecrets,
} from '@/features/integrations/ibkr/redact';
import { FlexError, FLEX_ERROR_CATEGORIES } from '@/features/integrations/ibkr/types';
import { fetchFlexReport, __resetPacing } from '@/features/integrations/ibkr/client';
import { checkFlexConnection } from '@/features/integrations/ibkr/connection-check';
import { staticFlexCredentialSource } from '@/features/integrations/ibkr/credentials';

const CREDS = { token: 'TEST_TOKEN_NOT_REAL_000111222', queryId: 'TEST_QUERY_9999' };

// --- fixtures --------------------------------------------------------------

const SEND_OK = `<?xml version="1.0" encoding="UTF-8"?>
<FlexStatementResponse timestamp="26 July, 2026 12:00 PM EDT">
<Status>Success</Status>
<ReferenceCode>1234567890</ReferenceCode>
<Url>https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement</Url>
</FlexStatementResponse>`;

const SEND_NO_REFERENCE = `<FlexStatementResponse>
<Status>Success</Status>
</FlexStatementResponse>`;

const PENDING = `<FlexStatementResponse>
<Status>Warn</Status>
<ErrorCode>1019</ErrorCode>
<ErrorMessage>Statement generation in progress. Please try again shortly.</ErrorMessage>
</FlexStatementResponse>`;

const EXPIRED_TOKEN = `<FlexStatementResponse>
<Status>Fail</Status>
<ErrorCode>1012</ErrorCode>
<ErrorMessage>Token has expired.</ErrorMessage>
</FlexStatementResponse>`;

const INVALID_TOKEN = `<FlexStatementResponse>
<Status>Fail</Status>
<ErrorCode>1015</ErrorCode>
<ErrorMessage>Token is invalid.</ErrorMessage>
</FlexStatementResponse>`;

const INVALID_QUERY = `<FlexStatementResponse>
<Status>Fail</Status>
<ErrorCode>1014</ErrorCode>
<ErrorMessage>Query is invalid.</ErrorMessage>
</FlexStatementResponse>`;

const PACING = `<FlexStatementResponse>
<Status>Fail</Status>
<ErrorCode>1018</ErrorCode>
<ErrorMessage>Too many requests have been made from this token. Please try again shortly.</ErrorMessage>
</FlexStatementResponse>`;

const STATEMENT_WITH_TRADES = `<?xml version="1.0" encoding="UTF-8"?>
<FlexQueryResponse queryName="MetaTradee Activity" type="AF">
<FlexStatements count="1">
<FlexStatement accountId="DU5551234" fromDate="20260701" toDate="20260726" period="LastMonth" whenGenerated="20260726;120000">
<Trades>
<Trade accountId="DU5551234" currency="USD" assetCategory="STK" symbol="AAPL" tradeID="55501" ibExecID="0000e1a.68a1b2c3.01.01" dateTime="20260715;103015" quantity="100" tradePrice="150.25" ibCommission="-1.05" buySell="BUY" />
<Trade accountId="DU5551234" currency="USD" assetCategory="FUT" symbol="ESU6" tradeID="55502" ibExecID="0000e1a.68a1b2c3.01.02" dateTime="20260716;141500" quantity="-2" tradePrice="5612.75" ibCommission="-4.30" buySell="SELL" />
</Trades>
</FlexStatement>
</FlexStatements>
</FlexQueryResponse>`;

const STATEMENT_EMPTY = `<FlexQueryResponse queryName="MetaTradee Activity" type="AF">
<FlexStatements count="1">
<FlexStatement accountId="DU5551234" fromDate="20260701" toDate="20260726" whenGenerated="20260726;120000">
<Trades>
</Trades>
</FlexStatement>
</FlexStatements>
</FlexQueryResponse>`;

const MALFORMED = '<FlexQueryResponse><FlexStatements count="1"><FlexStatement accountId=';

/** A fetch stub that returns the given bodies in order. */
function fetchSequence(bodies: (string | { status: number; body?: string })[]) {
  const calls: string[] = [];
  const impl = vi.fn(async (url: URL | RequestInfo) => {
    calls.push(String(url));
    const next = bodies.shift() ?? '';
    if (typeof next === 'string') {
      return { ok: true, status: 200, text: async () => next } as unknown as Response;
    }
    return {
      ok: next.status < 400,
      status: next.status,
      text: async () => next.body ?? '',
    } as unknown as Response;
  });
  return { impl, calls };
}

const noSleep = vi.fn(async () => {});

beforeEach(() => {
  __resetPacing();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// SendRequest
// ---------------------------------------------------------------------------

describe('SendRequest', () => {
  it('reads the reference code from a successful response', () => {
    expect(parseSendRequest(SEND_OK)).toEqual({ referenceCode: '1234567890' });
  });

  it('treats a Success without a ReferenceCode as malformed, not success', () => {
    expect(() => parseSendRequest(SEND_NO_REFERENCE)).toThrowError(
      expect.objectContaining({ category: 'malformed_xml' }),
    );
  });

  it('rejects a body that is not a Flex envelope', () => {
    expect(() => parseSendRequest('<html>gateway error</html>')).toThrowError(
      expect.objectContaining({ category: 'malformed_xml' }),
    );
  });

  it.each([
    [EXPIRED_TOKEN, 'expired_token'],
    [INVALID_TOKEN, 'invalid_token'],
    [INVALID_QUERY, 'invalid_query'],
    [PACING, 'pacing_limit'],
    [PENDING, 'report_pending'],
  ])('maps an IBKR failure to its safe category (%#)', (xml, category) => {
    expect(() => parseSendRequest(xml)).toThrowError(expect.objectContaining({ category }));
  });
});

// ---------------------------------------------------------------------------
// Statement parsing
// ---------------------------------------------------------------------------

describe('statement parsing', () => {
  it('parses trades deterministically, preserving every supplied field', () => {
    const report = parseStatement(STATEMENT_WITH_TRADES);

    expect(report.queryName).toBe('MetaTradee Activity');
    expect(report.accountId).toBe('DU5551234');
    expect(report.period).toEqual({
      from: '2026-07-01T00:00:00Z',
      to: '2026-07-26T00:00:00Z',
    });
    expect(report.trades).toHaveLength(2);

    expect(report.trades[0]).toEqual({
      execId: '0000e1a.68a1b2c3.01.01',
      tradeId: '55501',
      symbol: 'AAPL',
      assetCategory: 'STK',
      currency: 'USD',
      direction: 'buy',
      quantity: 100,
      price: 150.25,
      commission: -1.05,
      executedAt: '2026-07-15T10:30:15Z',
    });
    expect(report.trades[1]).toMatchObject({
      symbol: 'ESU6',
      assetCategory: 'FUT',
      direction: 'sell',
      quantity: -2,
      price: 5612.75,
      commission: -4.3,
    });
  });

  it('is deterministic across repeated parses', () => {
    expect(parseStatement(STATEMENT_WITH_TRADES)).toEqual(parseStatement(STATEMENT_WITH_TRADES));
  });

  it('treats a valid empty report as success with zero trades', () => {
    const report = parseStatement(STATEMENT_EMPTY);
    expect(report.trades).toEqual([]);
    expect(report.accountId).toBe('DU5551234');
  });

  it('throws malformed_xml rather than reporting zero trades for a broken document', () => {
    for (const bad of [MALFORMED, '', 'not xml at all', '<FlexQueryResponse>']) {
      expect(() => parseStatement(bad)).toThrowError(
        expect.objectContaining({ category: 'malformed_xml' }),
      );
    }
  });

  it('maps a pending envelope arriving on GetStatement', () => {
    expect(() => parseStatement(PENDING)).toThrowError(
      expect.objectContaining({ category: 'report_pending' }),
    );
  });

  it('never invents a value IBKR did not supply', () => {
    const sparse = `<FlexQueryResponse><FlexStatements count="1">
      <FlexStatement accountId="DU1"><Trades>
      <Trade symbol="AAPL" />
      </Trades></FlexStatement></FlexStatements></FlexQueryResponse>`;
    const trade = parseStatement(sparse).trades[0]!;

    // Absent numbers are null, NOT zero — a missing commission is not free.
    expect(trade.commission).toBeNull();
    expect(trade.quantity).toBeNull();
    expect(trade.price).toBeNull();
    expect(trade.direction).toBeNull();
    expect(trade.executedAt).toBeNull();
  });

  it('parses IBKR timestamps and refuses to guess unparseable ones', () => {
    expect(parseFlexDateTime('20260715;103015')).toBe('2026-07-15T10:30:15Z');
    expect(parseFlexDateTime('20260715')).toBe('2026-07-15T00:00:00Z');
    expect(parseFlexDateTime('15/07/2026')).toBeNull();
    expect(parseFlexDateTime(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Retry, pacing and cancellation
// ---------------------------------------------------------------------------

describe('bounded retry and pacing', () => {
  it('retries a pending report and succeeds once it is ready', async () => {
    const { impl } = fetchSequence([SEND_OK, PENDING, PENDING, STATEMENT_WITH_TRADES]);
    const report = await fetchFlexReport(CREDS, { fetchImpl: impl, sleep: noSleep });

    expect(report.trades).toHaveLength(2);
    expect(impl).toHaveBeenCalledTimes(4); // 1 send + 3 statement reads
  });

  it('gives up after a bounded number of attempts and reports pending', async () => {
    const { impl } = fetchSequence([SEND_OK, PENDING, PENDING, PENDING, PENDING, PENDING]);
    await expect(
      fetchFlexReport(CREDS, { fetchImpl: impl, sleep: noSleep, maxAttempts: 3 }),
    ).rejects.toThrowError(expect.objectContaining({ category: 'report_pending' }));

    // Bounded: 1 send + exactly 3 reads, never an unbounded poll.
    expect(impl).toHaveBeenCalledTimes(4);
  });

  it('does not retry a non-pending failure', async () => {
    const { impl } = fetchSequence([SEND_OK, EXPIRED_TOKEN, STATEMENT_WITH_TRADES]);
    await expect(fetchFlexReport(CREDS, { fetchImpl: impl, sleep: noSleep })).rejects.toThrowError(
      expect.objectContaining({ category: 'expired_token' }),
    );

    expect(impl).toHaveBeenCalledTimes(2); // stopped immediately
  });

  it('spaces requests by at least one second', async () => {
    const { impl } = fetchSequence([SEND_OK, STATEMENT_WITH_TRADES]);
    const sleeps: number[] = [];
    let clock = 1_000_000;

    await fetchFlexReport(CREDS, {
      fetchImpl: impl,
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
    });

    // The second call had to wait out the 1s minimum spacing.
    expect(sleeps.some((ms) => ms >= 1_000)).toBe(true);
  });

  it('refuses rather than hanging once ten requests occur inside a minute', async () => {
    const bodies = Array.from({ length: 12 }, () => SEND_OK);
    const { impl } = fetchSequence(bodies);
    let clock = 2_000_000;
    const deps = { fetchImpl: impl, sleep: noSleep, now: () => clock };

    // Ten requests inside the same minute exhausts the window.
    for (let i = 0; i < 10; i += 1) {
      clock += 1_000;
      await fetchFlexReport(CREDS, { ...deps, maxAttempts: 0 }).catch(() => undefined);
    }

    await expect(fetchFlexReport(CREDS, { ...deps, maxAttempts: 1 })).rejects.toThrowError(
      expect.objectContaining({ category: 'pacing_limit' }),
    );
  });

  it('maps a 429 and a 5xx to their categories', async () => {
    for (const [status, category] of [
      [429, 'pacing_limit'],
      [503, 'ibkr_unavailable'],
    ] as const) {
      __resetPacing();
      const { impl } = fetchSequence([{ status }]);
      await expect(
        fetchFlexReport(CREDS, { fetchImpl: impl, sleep: noSleep }),
      ).rejects.toThrowError(expect.objectContaining({ category }));
    }
  });

  it('maps a transport failure to network without leaking the cause', async () => {
    const impl = vi.fn(async () => {
      throw new TypeError(`connect ECONNREFUSED using ${CREDS.token}`);
    });
    await expect(
      fetchFlexReport(CREDS, { fetchImpl: impl as unknown as typeof fetch, sleep: noSleep }),
    ).rejects.toThrowError(expect.objectContaining({ category: 'network' }));

    const error: unknown = await fetchFlexReport(CREDS, {
      fetchImpl: impl as unknown as typeof fetch,
      sleep: noSleep,
    }).catch((cause: unknown) => cause);
    // The provider's own message named the token; ours must not.
    expect((error as Error).message).not.toContain(CREDS.token);
  });

  it('honours cancellation', async () => {
    const controller = new AbortController();
    const impl = vi.fn(async () => {
      controller.abort();
      throw new DOMException('Aborted', 'AbortError');
    });
    await expect(
      fetchFlexReport(CREDS, {
        fetchImpl: impl as unknown as typeof fetch,
        sleep: noSleep,
        signal: controller.signal,
      }),
    ).rejects.toThrowError(expect.objectContaining({ category: 'network' }));
  });
});

// ---------------------------------------------------------------------------
// Redaction and masking
// ---------------------------------------------------------------------------

describe('redaction', () => {
  it('masks an account id to a prefix and two digits', () => {
    expect(maskAccountId('U1234567')).toBe('U•••••67');
    expect(maskAccountId('DU5551234')).toBe('DU•••••34');
  });

  it('never returns a full account number, however short', () => {
    for (const id of ['U1', 'DU', 'X', 'U1234567', 'DU5551234']) {
      expect(maskAccountId(id)).not.toBe(id);
    }
    expect(maskAccountId(null)).toBeNull();
    expect(maskAccountId('')).toBeNull();
  });

  it('reports paper only for a DU account, never guessing live', () => {
    expect(classifyEnvironment('DU5551234')).toBe('paper');
    expect(classifyEnvironment('U1234567')).toBe('unknown');
    expect(classifyEnvironment(null)).toBe('unknown');
  });

  it('strips token and query parameters out of any string', () => {
    const url = `https://ndcdyn.interactivebrokers.com/x/SendRequest?t=${CREDS.token}&q=${CREDS.queryId}&v=3`;
    const safe = redactSecrets(url);
    expect(safe).not.toContain(CREDS.token);
    expect(safe).not.toContain(CREDS.queryId);
    expect(safe).toContain('REDACTED');
  });
});

// ---------------------------------------------------------------------------
// The safe result projection
// ---------------------------------------------------------------------------

describe('connection check result', () => {
  const source = staticFlexCredentialSource(CREDS);

  it('reports success with a masked account and a real trade count', async () => {
    const { impl } = fetchSequence([SEND_OK, STATEMENT_WITH_TRADES]);
    const result = await checkFlexConnection({
      credentialSource: source,
      fetchImpl: impl,
      sleep: noSleep,
    });

    expect(result.ok).toBe(true);
    expect(result.provider).toBe('ibkr-flex');
    expect(result.environment).toBe('paper');
    expect(result.reportStatus).toBe('ready');
    expect(result.tradeCount).toBe(2);
    expect(result.account).toBe('DU•••••34');
    expect(result.period).toEqual({ from: '2026-07-01T00:00:00Z', to: '2026-07-26T00:00:00Z' });
  });

  it('reports a valid empty report as success with zero trades', async () => {
    const { impl } = fetchSequence([SEND_OK, STATEMENT_EMPTY]);
    const result = await checkFlexConnection({
      credentialSource: source,
      fetchImpl: impl,
      sleep: noSleep,
    });
    expect(result.ok).toBe(true);
    expect(result.tradeCount).toBe(0);
  });

  it('omits tradeCount entirely when the report could not be read', async () => {
    const { impl } = fetchSequence([SEND_OK, MALFORMED]);
    const result = await checkFlexConnection({
      credentialSource: source,
      fetchImpl: impl,
      sleep: noSleep,
    });

    expect(result.ok).toBe(false);
    expect(result.category).toBe('malformed_xml');
    // Malformed must never be reported as "0 trades".
    expect(result.tradeCount).toBeUndefined();
  });

  it('fails closed with missing_configuration and makes no request', async () => {
    const impl = vi.fn();
    const result = await checkFlexConnection({
      credentialSource: { id: 'none', getCredentials: async () => null },
      fetchImpl: impl as unknown as typeof fetch,
      sleep: noSleep,
    });

    expect(result).toMatchObject({ ok: false, category: 'missing_configuration' });
    expect(impl).not.toHaveBeenCalled();
  });

  it('never includes a secret, raw XML, account number or stack in the result', async () => {
    const cases = [SEND_OK, EXPIRED_TOKEN, INVALID_QUERY, MALFORMED, PACING];
    for (const second of cases) {
      __resetPacing();
      const { impl } = fetchSequence([SEND_OK, second]);
      const result = await checkFlexConnection({
        credentialSource: source,
        fetchImpl: impl,
        sleep: noSleep,
        maxAttempts: 1,
      });
      const serialized = JSON.stringify(result);

      expect(serialized).not.toContain(CREDS.token);
      expect(serialized).not.toContain(CREDS.queryId);
      expect(serialized).not.toContain('DU5551234');
      expect(serialized).not.toContain('<FlexQueryResponse');
      expect(serialized).not.toContain('interactivebrokers.com');
      expect(serialized).not.toMatch(/\bat\s+\w+\s+\(/); // no stack frames
    }
  });

  it('only ever reports a category from the fixed safe list', async () => {
    const bodies = [EXPIRED_TOKEN, INVALID_TOKEN, INVALID_QUERY, PACING, MALFORMED, PENDING];
    for (const body of bodies) {
      __resetPacing();
      const { impl } = fetchSequence([body]);
      const result = await checkFlexConnection({
        credentialSource: source,
        fetchImpl: impl,
        sleep: noSleep,
        maxAttempts: 1,
      });
      expect(FLEX_ERROR_CATEGORIES).toContain(result.category);
    }
  });
});

// ---------------------------------------------------------------------------
// Boundary guarantees
// ---------------------------------------------------------------------------

describe('architecture boundary', () => {
  it('accepts credentials as a value, so a per-user source can replace env', async () => {
    const perUser = staticFlexCredentialSource(
      { token: 'USER_SCOPED_TOKEN_XYZ', queryId: 'USER_QUERY_1' },
      'user:abc',
    );
    const { impl, calls } = fetchSequence([SEND_OK, STATEMENT_EMPTY]);

    const result = await checkFlexConnection({
      credentialSource: perUser,
      fetchImpl: impl,
      sleep: noSleep,
    });

    expect(result.ok).toBe(true);
    // The per-user credential really was the one used.
    expect(calls[0]).toContain('USER_SCOPED_TOKEN_XYZ');
  });

  it('categorises every FlexError from the fixed list', () => {
    for (const category of FLEX_ERROR_CATEGORIES) {
      const error = new FlexError(category);
      expect(error.category).toBe(category);
      expect(error.message.length).toBeGreaterThan(0);
    }
  });
});
