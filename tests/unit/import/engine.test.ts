import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  detectDelimiter,
  parseLocaleNumber,
  parseBrokerDate,
  parseJsonRows,
  stripBom,
} from '@/features/import/parse';
import { ADAPTERS, getAdapter, autoDetectMapping } from '@/features/import/adapters';
import { buildPreview, normalizeRow, hashCandidate, chunk } from '@/features/import/pipeline';
import { tradeContentHash } from '@/features/journal/dedupe';
import { computeDerivedTradeFields } from '@/features/journal/derived';
import type { MappableField } from '@/features/import/adapters';

const HEADERS = [
  'Symbol',
  'Type',
  'Open Time',
  'Close Time',
  'Volume',
  'Open Price',
  'Close Price',
  'Commission',
];
const MAPPING: Partial<Record<MappableField, number>> = {
  symbol: 0,
  direction: 1,
  opened_at: 2,
  closed_at: 3,
  quantity: 4,
  entry_price: 5,
  exit_price: 6,
  commission: 7,
};
const ROW = [
  'EURUSD',
  'buy',
  '2026.01.05 10:00:00',
  '2026.01.05 12:30:00',
  '1.5',
  '1.0850',
  '1.0900',
  '2',
];
const generic = getAdapter('generic');

describe('CSV parsing (encoding/delimiter/quoting edge cases)', () => {
  it('detects delimiters and strips the BOM', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
    expect(stripBom('﻿symbol').charCodeAt(0)).not.toBe(0xfeff);
  });

  it('handles RFC-4180 quoted fields, escaped quotes, embedded newlines', () => {
    const rows = parseCsv('sym,note\nEURUSD,"said ""go"",\nthen left"');
    expect(rows[1]![1]).toBe('said "go",\nthen left');
  });

  it('parses JSON exports into headers + rows', () => {
    const r = parseJsonRows('[{"symbol":"EURUSD","side":"buy"}]');
    expect(r?.headers).toEqual(['symbol', 'side']);
    expect(r?.rows[0]).toEqual(['EURUSD', 'buy']);
    expect(parseJsonRows('not json')).toBeNull();
  });
});

describe('locale numbers + broker dates (deterministic, never guessed)', () => {
  it('parses mixed locale numbers', () => {
    expect(parseLocaleNumber('1,234.56')).toBe(1234.56);
    expect(parseLocaleNumber('1.234,56')).toBe(1234.56);
    expect(parseLocaleNumber('1 234,56')).toBe(1234.56);
    expect(parseLocaleNumber('12,34')).toBe(12.34);
    expect(parseLocaleNumber('1,234')).toBe(1234);
    expect(parseLocaleNumber('abc')).toBeNull();
  });

  it('parses broker date formats to UTC ISO', () => {
    expect(parseBrokerDate('2026.01.05 10:00:00')).toBe('2026-01-05T10:00:00.000Z');
    expect(parseBrokerDate('2026-01-05 10:00')).toBe('2026-01-05T10:00:00.000Z');
    expect(parseBrokerDate('05/01/2026 10:00')).toBe('2026-01-05T10:00:00.000Z'); // day-first
    expect(parseBrokerDate('2026-01-05T10:00:00+02:00')).toBe('2026-01-05T08:00:00.000Z');
    expect(parseBrokerDate('1767607200')).toMatch(/^2026-01-05T/); // epoch seconds
    expect(parseBrokerDate('nonsense')).toBeNull();
    expect(parseBrokerDate('2026.13.40')).toBeNull(); // impossible date rejected
  });
});

describe('adapters: adding a platform is a declaration, zero pipeline changes', () => {
  it('ships all six platforms + generic through one interface', () => {
    const ids = ADAPTERS.map((a) => a.id);
    for (const p of ['generic', 'mt4', 'mt5', 'ctrader', 'dxtrade', 'match-trader', 'tradelocker'])
      expect(ids).toContain(p);
    // Live API sync is a documented seam on every adapter — never required.
    for (const a of ADAPTERS) expect(a.liveSync).toBe('seam');
  });

  it('auto-detects MT4-style headers deterministically', () => {
    const m = autoDetectMapping(HEADERS, getAdapter('mt4'));
    expect(m.symbol).toBe(0);
    expect(m.direction).toBe(1);
    expect(m.opened_at).toBe(2);
    expect(m.entry_price).toBe(5);
  });
});

describe('normalize → SHARED journal schema (server-authoritative, captured errors)', () => {
  it('produces a valid shared-schema trade from a broker row', () => {
    const { input, errors } = normalizeRow(ROW, MAPPING, generic, null);
    expect(errors).toEqual([]);
    expect(input?.symbol).toBe('EURUSD');
    expect(input?.direction).toBe('buy');
    expect(input?.entry_price).toBe(1.085);
    expect(input?.opened_at).toBe('2026-01-05T10:00:00.000Z');
  });

  it('captures malformed rows with reasons — never silently drops', () => {
    const bad = ['EURUSD', 'sideways', 'not-a-date', '', 'x', '1.08', '1.09', '0'];
    const { input, errors } = normalizeRow(bad, MAPPING, generic, null);
    expect(input).toBeUndefined();
    expect(errors.join(' ')).toMatch(/direction/i);
    expect(errors.join(' ')).toMatch(/date/i);
  });
});

describe('dedupe reuses the JOURNAL rule (one definition) + idempotency', () => {
  it('preserves account association in normalized rows and dedupe hashes', () => {
    const accountId = '8b223cc4-83fd-42de-99a7-2893294bd830';
    const first = buildPreview([ROW], MAPPING, generic, accountId, new Set());
    expect(first.valid[0]?.input.trading_account_id).toBe(accountId);
    const unassigned = buildPreview([ROW], MAPPING, generic, null, new Set());
    expect(first.valid[0]?.contentHash).not.toBe(unassigned.valid[0]?.contentHash);
  });

  it('pipeline hash === journal tradeContentHash for the same trade', () => {
    const { input } = normalizeRow(ROW, MAPPING, generic, null);
    const { full } = hashCandidate(input!);
    const journalHash = tradeContentHash({
      trading_account_id: null,
      symbol: 'EURUSD',
      direction: 'buy',
      time: '2026-01-05T10:00:00.000Z',
      quantity: 1.5,
      entry_price: 1.085,
    });
    expect(full).toBe(journalHash);
  });

  it('IDEMPOTENT: re-running the same file classifies every row as duplicate', () => {
    const first = buildPreview([ROW], MAPPING, generic, null, new Set());
    expect(first.counts.valid).toBe(1);
    // Simulate the first run having been committed: its hashes now exist.
    const committed = new Set(first.valid.map((r) => r.contentHash));
    const second = buildPreview([ROW], MAPPING, generic, null, committed);
    expect(second.counts.valid).toBe(0);
    expect(second.counts.duplicate).toBe(1); // never double-inserts
  });

  it('detects in-file duplicates and surfaces them (nothing silently merged)', () => {
    const p = buildPreview([ROW, [...ROW]], MAPPING, generic, null, new Set());
    expect(p.counts.valid).toBe(1);
    expect(p.counts.duplicate).toBe(1);
    expect(p.duplicates[0]?.reason).toBe('in_file');
  });
});

describe('RECONCILIATION: imported trades use the exact same derived math as manual', () => {
  it('normalized import input → computeDerivedTradeFields matches a manual trade', () => {
    const { input } = normalizeRow(ROW, MAPPING, generic, null);
    const derived = computeDerivedTradeFields({
      direction: input!.direction,
      entry_price: input!.entry_price ?? null,
      exit_price: input!.exit_price ?? null,
      quantity: input!.quantity ?? null,
      stop_loss: null,
      take_profit: null,
      risk_amount: null,
      reward: null,
      commission: input!.commission,
      swap: input!.swap,
      fees: input!.fees,
      opened_at: input!.opened_at ?? null,
      closed_at: input!.closed_at ?? null,
    });
    // (1.0900 - 1.0850) * 1.5 = 0.0075 → rounded money 0.01; net = 0.01 - 2
    expect(derived.pnl).toBe(0.01);
    expect(derived.net_pnl).toBe(-1.99);
    expect(derived.duration_seconds).toBe(2.5 * 3600);
  });
});

describe('chunking (bounded batches for resumable commits)', () => {
  it('splits into bounded batches preserving order', () => {
    const batches = chunk([1, 2, 3, 4, 5], 2);
    expect(batches).toEqual([[1, 2], [3, 4], [5]]);
  });
});
