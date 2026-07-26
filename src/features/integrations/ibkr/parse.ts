/**
 * Flex XML parsing. Pure: no network, no secrets, no persistence.
 *
 * WHY A HAND-WRITTEN PARSER: the Flex payloads this integration accepts are a
 * small, strictly-shaped, attribute-only subset. A general XML dependency would
 * add supply-chain surface for one format, and a lenient DOM parser is the
 * wrong tool here — leniency is exactly the failure mode to avoid. This parser
 * FAILS CLOSED: anything it cannot positively recognise as a valid Flex
 * document raises `malformed_xml` rather than returning a plausible-looking
 * empty result.
 *
 * The critical distinction the spec calls for:
 *   a VALID report containing zero trades  → success, tradeCount 0
 *   a MALFORMED document                   → malformed_xml, never "0 trades"
 */
import { FlexError, type FlexPeriod, type FlexReport, type FlexTrade } from './types';

/**
 * IBKR error codes observed for "the statement is not ready yet". Treated as
 * best-effort: the message-based checks below carry the real weight, so an
 * unlisted pending code still resolves correctly.
 */
const PENDING_CODES = new Set(['1003', '1005', '1006', '1007', '1008', '1009', '1011', '1019']);

/** Read one attribute off an XML tag body. Attribute-only by design. */
function attr(tagBody: string, name: string): string | null {
  const match = tagBody.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'));
  const value = match?.[1]?.trim();
  return value ? value : null;
}

/** Read the text content of a simple `<Name>value</Name>` element. */
function element(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<${name}\\s*>([\\s\\S]*?)</${name}\\s*>`, 'i'));
  const value = match?.[1]?.trim();
  return value ? value : null;
}

/** A number IBKR supplied, or null. An unparseable value is null, never 0. */
function num(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * IBKR timestamps arrive as `YYYYMMDD;HHmmss`, `YYYYMMDD HHmmss` or `YYYYMMDD`.
 * Anything else yields null rather than a guessed date.
 */
export function parseFlexDateTime(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[;\s]+/, ' ');
  const match = cleaned.match(/^(\d{4})(\d{2})(\d{2})(?:\s(\d{2})(\d{2})(\d{2}))?$/);
  if (!match) return null;

  const [, y, mo, d, h = '00', mi = '00', s = '00'] = match;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/** IBKR reports direction as BUY / SELL. Anything else is null, not a guess. */
function parseDirection(raw: string | null): 'buy' | 'sell' | null {
  const value = raw?.trim().toUpperCase();
  if (value === 'BUY' || value === 'B') return 'buy';
  if (value === 'SELL' || value === 'S') return 'sell';
  return null;
}

/**
 * Interpret a `<FlexStatementResponse>` envelope — the shape BOTH SendRequest
 * and a not-yet-ready GetStatement return. Throws the mapped category on any
 * non-success status.
 */
function readStatusEnvelope(xml: string): { status: string } {
  const status = element(xml, 'Status');
  if (!status) throw new FlexError('malformed_xml');

  if (/^success$/i.test(status)) return { status };

  const code = element(xml, 'ErrorCode') ?? '';
  const message = (element(xml, 'ErrorMessage') ?? '').toLowerCase();

  // Pacing BEFORE pending. IBKR ends its throttling message with "please try
  // again shortly" too, so a generic wait-and-retry phrase cannot be used to
  // identify a still-generating report — misreading a throttle as "pending"
  // would retry straight into the limit and get the token throttled harder.
  if (/too many request|exceeded the number|pacing|rate limit/.test(message)) {
    throw new FlexError('pacing_limit', true);
  }
  // Pending: IBKR reports "in progress" as a failure status, but it is the
  // normal path immediately after SendRequest, not an error. Matched on
  // generation language or a known code, never on "try again" alone.
  if (PENDING_CODES.has(code) || /in progress|generat|not ready|not yet available/.test(message)) {
    throw new FlexError('report_pending', true);
  }
  if (/expired/.test(message)) throw new FlexError('expired_token');
  if (/token/.test(message)) throw new FlexError('invalid_token');
  if (/quer/.test(message)) throw new FlexError('invalid_query');
  if (/unable to validate|invalid request/.test(message)) throw new FlexError('invalid_token');
  if (/not available|could not be generated|cannot be generated/.test(message)) {
    throw new FlexError('ibkr_unavailable', true);
  }
  throw new FlexError('unknown');
}

/**
 * Parse a SendRequest response into a reference code.
 *
 * A Success status without a ReferenceCode is malformed, not success — the
 * whole point of the call is the code.
 */
export function parseSendRequest(xml: string): { referenceCode: string } {
  if (!/<FlexStatementResponse[\s>]/i.test(xml)) throw new FlexError('malformed_xml');
  readStatusEnvelope(xml);

  const referenceCode = element(xml, 'ReferenceCode');
  if (!referenceCode) throw new FlexError('malformed_xml');
  return { referenceCode };
}

function parseTrades(statementXml: string): FlexTrade[] {
  // Self-closing or paired <Trade .../> elements, attribute-only.
  const matches = statementXml.matchAll(/<Trade\b([^>]*?)\/?>/gi);
  const trades: FlexTrade[] = [];

  for (const match of matches) {
    const body = match[1] ?? '';
    trades.push({
      execId: attr(body, 'ibExecID') ?? attr(body, 'execID'),
      tradeId: attr(body, 'tradeID'),
      symbol: attr(body, 'symbol'),
      assetCategory: attr(body, 'assetCategory'),
      currency: attr(body, 'currency'),
      direction: parseDirection(attr(body, 'buySell')),
      quantity: num(attr(body, 'quantity')),
      price: num(attr(body, 'tradePrice') ?? attr(body, 'price')),
      commission: num(attr(body, 'ibCommission') ?? attr(body, 'commission')),
      executedAt: parseFlexDateTime(attr(body, 'dateTime') ?? attr(body, 'tradeDate')),
    });
  }
  return trades;
}

/**
 * Parse a complete Flex statement.
 *
 * Accepts a `<FlexQueryResponse>` containing at least one `<FlexStatement>`.
 * A statement with no `<Trades>` section, or an empty one, is a VALID report
 * with zero trades. A document that is not a Flex statement — truncated,
 * unterminated, or an unrelated body — throws `malformed_xml`.
 */
export function parseStatement(xml: string): FlexReport {
  // A pending/failed envelope may arrive on this endpoint too; map it properly
  // instead of reporting "malformed".
  if (/<FlexStatementResponse[\s>]/i.test(xml)) {
    readStatusEnvelope(xml);
  }

  if (!/<FlexQueryResponse[\s>]/i.test(xml) || !/<\/FlexQueryResponse\s*>/i.test(xml)) {
    throw new FlexError('malformed_xml');
  }

  const statementMatch = xml.match(/<FlexStatement\b([^>]*)>([\s\S]*?)<\/FlexStatement\s*>/i);
  if (!statementMatch) throw new FlexError('malformed_xml');

  const statementAttrs = statementMatch[1] ?? '';
  const statementBody = statementMatch[2] ?? '';

  const queryResponseAttrs = xml.match(/<FlexQueryResponse\b([^>]*)>/i)?.[1] ?? '';

  const period: FlexPeriod = {
    from: parseFlexDateTime(attr(statementAttrs, 'fromDate')),
    to: parseFlexDateTime(attr(statementAttrs, 'toDate')),
  };

  return {
    accountId: attr(statementAttrs, 'accountId'),
    queryName: attr(queryResponseAttrs, 'queryName'),
    period,
    whenGenerated: parseFlexDateTime(attr(statementAttrs, 'whenGenerated')),
    trades: parseTrades(statementBody),
  };
}
