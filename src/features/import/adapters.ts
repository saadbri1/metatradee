/**
 * Provider adapters (Phase 10.8). An adapter is a DECLARATION — header synonyms
 * per internal trade field + value normalizers. The pipeline (parse → map →
 * validate → dedupe → preview → ingest) is provider-agnostic: adding a platform
 * means adding an adapter object here, with ZERO changes to the core pipeline.
 *
 * File/statement-based import only. Live API sync per platform is a documented
 * seam (`liveSync: 'seam'`) — never required, never using production credentials.
 */

/** Internal fields an adapter can map. Mirrors the shared trade schema. */
export type MappableField =
  | 'symbol'
  | 'direction'
  | 'entry_price'
  | 'exit_price'
  | 'quantity'
  | 'stop_loss'
  | 'take_profit'
  | 'commission'
  | 'swap'
  | 'fees'
  | 'opened_at'
  | 'closed_at'
  | 'notes';

export interface ImportAdapter {
  id: string;
  label: string;
  /** File formats this adapter's statements arrive in. */
  formats: readonly ('csv' | 'json')[];
  /** Header synonyms (lowercased) per internal field — the mapping heuristic. */
  headerMap: Partial<Record<MappableField, readonly string[]>>;
  /** Normalize a raw direction cell to 'buy' | 'sell' (null = unmappable). */
  normalizeDirection?: (raw: string) => 'buy' | 'sell' | null;
  /** Live/API sync status: implemented file import; API left as a seam. */
  liveSync: 'seam';
}

/** Common direction vocabulary across platforms. */
export function defaultDirection(raw: string): 'buy' | 'sell' | null {
  const v = raw.trim().toLowerCase();
  if (['buy', 'long', 'b', '0', 'buy limit', 'buy stop'].includes(v)) return 'buy';
  if (['sell', 'short', 's', '1', 'sell limit', 'sell stop'].includes(v)) return 'sell';
  return null;
}

/** Shared synonym base most platforms use. */
const BASE: ImportAdapter['headerMap'] = {
  symbol: ['symbol', 'instrument', 'ticker', 'pair', 'market'],
  direction: ['direction', 'side', 'type', 'action', 'buy/sell'],
  entry_price: ['entry price', 'entry', 'open price', 'price open', 'openprice', 'open'],
  exit_price: ['exit price', 'exit', 'close price', 'price close', 'closeprice', 'close'],
  quantity: ['quantity', 'volume', 'size', 'lots', 'lot size', 'amount', 'qty'],
  stop_loss: ['stop loss', 'sl', 's/l', 'stop'],
  take_profit: ['take profit', 'tp', 't/p', 'target'],
  commission: ['commission', 'comm', 'commissions'],
  swap: ['swap', 'rollover', 'financing'],
  fees: ['fees', 'fee', 'charges'],
  opened_at: ['open time', 'opened at', 'entry time', 'open date', 'time open', 'opentime'],
  closed_at: ['close time', 'closed at', 'exit time', 'close date', 'time close', 'closetime'],
  notes: ['comment', 'notes', 'note', 'description'],
};

function adapter(id: string, label: string, overrides: Partial<ImportAdapter> = {}): ImportAdapter {
  return {
    id,
    label,
    formats: ['csv', 'json'],
    headerMap: BASE,
    normalizeDirection: defaultDirection,
    liveSync: 'seam',
    ...overrides,
  };
}

/** Registry — the wizard lists these; the pipeline treats them uniformly. */
export const ADAPTERS: readonly ImportAdapter[] = [
  adapter('generic', 'Generic CSV / JSON'),
  adapter('mt4', 'MetaTrader 4', {
    headerMap: {
      ...BASE,
      opened_at: [...BASE.opened_at!, 'open time'],
      quantity: [...BASE.quantity!, 'lots'],
      symbol: [...BASE.symbol!, 'item'],
    },
  }),
  adapter('mt5', 'MetaTrader 5', {
    headerMap: {
      ...BASE,
      opened_at: [...BASE.opened_at!, 'time'],
      entry_price: [...BASE.entry_price!, 'price'],
    },
  }),
  adapter('ctrader', 'cTrader', {
    headerMap: {
      ...BASE,
      opened_at: [...BASE.opened_at!, 'opening time (utc)', 'created (utc)'],
      closed_at: [...BASE.closed_at!, 'closing time (utc)'],
      entry_price: [...BASE.entry_price!, 'entry price'],
      exit_price: [...BASE.exit_price!, 'closing price'],
    },
  }),
  adapter('dxtrade', 'DXtrade'),
  adapter('match-trader', 'Match-Trader'),
  adapter('tradelocker', 'TradeLocker', {
    headerMap: { ...BASE, quantity: [...BASE.quantity!, 'position size'] },
  }),
];

export function getAdapter(id: string): ImportAdapter {
  return ADAPTERS.find((a) => a.id === id) ?? ADAPTERS[0]!;
}

/**
 * Deterministic column auto-detection: for each internal field, find the first
 * header (case-insensitive, trimmed) matching the adapter's synonyms. Returns
 * header-index per field; the user can override any of it in the wizard.
 */
export function autoDetectMapping(
  headers: string[],
  a: ImportAdapter,
): Partial<Record<MappableField, number>> {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  const out: Partial<Record<MappableField, number>> = {};
  for (const [field, synonyms] of Object.entries(a.headerMap) as [
    MappableField,
    readonly string[],
  ][]) {
    for (const syn of synonyms) {
      const idx = normalized.indexOf(syn);
      if (idx !== -1) {
        out[field] = idx;
        break;
      }
    }
  }
  return out;
}
