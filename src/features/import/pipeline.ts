/**
 * Provider-agnostic import pipeline (Phase 10.8): map → normalize → VALIDATE via
 * the SHARED journal Zod schema → dedupe via the JOURNAL'S hash rule → preview.
 *
 * Zero writes here — preview IS the dry run; the commit action re-runs the same
 * validation server-side (authoritative) before writing through the journal's
 * trade service. Malformed rows are CAPTURED with their row number and errors,
 * never silently dropped. Derived fields (PnL/R/RR/duration) are NOT computed
 * here — `buildTradeRow` computes them at write time, so imported trades use the
 * exact same math, rounding, and money types as manual ones (reconciliation by
 * construction).
 */
import { tradeCreateSchema, type TradeCreateInput } from '@/features/journal/schemas';
import { tradeContentHash, tradePartialKey } from '@/features/journal/dedupe';
import { parseLocaleNumber, parseBrokerDate } from './parse';
import type { ImportAdapter, MappableField } from './adapters';
import { defaultDirection } from './adapters';

export interface RowIssue {
  rowIndex: number;
  errors: string[];
  raw: string[];
}

export interface PreparedRow {
  rowIndex: number;
  input: TradeCreateInput;
  contentHash: string;
  partialKey: string;
}

export interface ImportPreview {
  valid: PreparedRow[];
  /** Full-hash matches against existing trades OR within the file itself. */
  duplicates: (PreparedRow & { reason: 'existing' | 'in_file' })[];
  /** Partial matches (same account+symbol+direction+time, different fill). */
  partials: PreparedRow[];
  invalid: RowIssue[];
  counts: { total: number; valid: number; duplicate: number; partial: number; invalid: number };
}

const NUMBER_FIELDS: MappableField[] = [
  'entry_price',
  'exit_price',
  'quantity',
  'stop_loss',
  'take_profit',
  'commission',
  'swap',
  'fees',
];
const DATE_FIELDS: MappableField[] = ['opened_at', 'closed_at'];

/** Map + normalize one raw row into a shared-schema candidate. */
export function normalizeRow(
  cells: string[],
  mapping: Partial<Record<MappableField, number>>,
  adapter: ImportAdapter,
  accountId: string | null,
): { input?: TradeCreateInput; errors: string[] } {
  const errors: string[] = [];
  const get = (f: MappableField): string =>
    mapping[f] === undefined ? '' : (cells[mapping[f] as number] ?? '').trim();

  const candidate: Record<string, unknown> = {
    symbol: get('symbol'),
    trading_account_id: accountId,
    notes: get('notes') || '',
  };

  const dirRaw = get('direction');
  const dir = (adapter.normalizeDirection ?? defaultDirection)(dirRaw);
  if (dir === null) errors.push(`Unrecognized direction "${dirRaw}"`);
  else candidate.direction = dir;

  for (const f of NUMBER_FIELDS) {
    const raw = get(f);
    if (raw === '') continue;
    const n = parseLocaleNumber(raw);
    if (n === null) errors.push(`Invalid number for ${f}: "${raw}"`);
    else candidate[f] = n;
  }
  for (const f of DATE_FIELDS) {
    const raw = get(f);
    if (raw === '') continue;
    const iso = parseBrokerDate(raw);
    if (iso === null) errors.push(`Unrecognized date for ${f}: "${raw}"`);
    else candidate[f] = iso;
  }

  if (errors.length > 0) return { errors };

  // Authoritative validation via the SHARED journal schema (same as manual).
  const parsed = tradeCreateSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'row'}: ${i.message}`),
    };
  }
  return { input: parsed.data, errors: [] };
}

/** Content hash for a validated candidate — the JOURNAL'S rule, not a new one. */
export function hashCandidate(input: TradeCreateInput): { full: string; partial: string } {
  const key = {
    trading_account_id: input.trading_account_id ?? null,
    symbol: input.symbol,
    direction: input.direction,
    time: input.executed_at ?? input.opened_at ?? null,
    quantity: input.quantity ?? null,
    entry_price: input.entry_price ?? null,
  };
  return { full: tradeContentHash(key), partial: tradePartialKey(key) };
}

/**
 * Build the dry-run preview. `existingHashes`/`existingPartials` come from the
 * user's own trades (owner-scoped query). Nothing is written.
 */
export function buildPreview(
  rows: string[][],
  mapping: Partial<Record<MappableField, number>>,
  adapter: ImportAdapter,
  accountId: string | null,
  existingHashes: ReadonlySet<string>,
  existingPartials: ReadonlySet<string> = new Set(),
): ImportPreview {
  const valid: PreparedRow[] = [];
  const duplicates: ImportPreview['duplicates'] = [];
  const partials: PreparedRow[] = [];
  const invalid: RowIssue[] = [];
  const seenInFile = new Set<string>();

  rows.forEach((cells, i) => {
    const { input, errors } = normalizeRow(cells, mapping, adapter, accountId);
    if (!input) {
      invalid.push({ rowIndex: i, errors, raw: cells });
      return;
    }
    const { full, partial } = hashCandidate(input);
    const prepared: PreparedRow = { rowIndex: i, input, contentHash: full, partialKey: partial };

    if (existingHashes.has(full)) duplicates.push({ ...prepared, reason: 'existing' });
    else if (seenInFile.has(full)) duplicates.push({ ...prepared, reason: 'in_file' });
    else if (existingPartials.has(partial)) partials.push(prepared);
    else valid.push(prepared);

    seenInFile.add(full);
  });

  return {
    valid,
    duplicates,
    partials,
    invalid,
    counts: {
      total: rows.length,
      valid: valid.length,
      duplicate: duplicates.length,
      partial: partials.length,
      invalid: invalid.length,
    },
  };
}

/** Bounded batches for chunked, transactional, resumable commits. */
export function chunk<T>(items: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
