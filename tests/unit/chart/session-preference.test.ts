import { beforeEach, describe, expect, it } from 'vitest';
import {
  isValidSession,
  readSavedSession,
  resolveInitialSession,
  saveSession,
} from '@/features/chart/session-preference';
import type { ChartControlsValue } from '@/features/chart/components/chart-controls';

const STARTER: ChartControlsValue = {
  symbol: 'ESM2',
  timeframe: '1m',
  start: '2022-06-06T20:50',
  end: '2022-06-06T21:50',
};
const SAVED: ChartControlsValue = {
  symbol: 'MESU4',
  timeframe: '5m',
  start: '2024-06-10T13:30',
  end: '2024-06-10T20:00',
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('session validation', () => {
  it('accepts a well-formed session and rejects malformed ones', () => {
    expect(isValidSession(STARTER)).toBe(true);
    expect(isValidSession({ ...STARTER, timeframe: '3s' })).toBe(false);
    expect(isValidSession({ ...STARTER, start: '2022-06-06' })).toBe(false);
    expect(isValidSession({ ...STARTER, symbol: '' })).toBe(false);
    // An inverted range would always fail upstream.
    expect(isValidSession({ ...STARTER, start: STARTER.end, end: STARTER.start })).toBe(false);
    expect(isValidSession(null)).toBe(false);
  });
});

describe('persistence', () => {
  it('round-trips only safe session metadata', () => {
    saveSession(SAVED);
    expect(readSavedSession()).toEqual(SAVED);
    const raw = window.localStorage.getItem('metatradee-chart-session')!;
    // No credentials or candle payload may ever be stored.
    expect(raw).not.toMatch(/key|token|candle|password/i);
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(['end', 'start', 'symbol', 'timeframe']);
  });

  it('ignores a corrupt or stale saved entry', () => {
    window.localStorage.setItem('metatradee-chart-session', '{not json');
    expect(readSavedSession()).toBeNull();
    window.localStorage.setItem('metatradee-chart-session', JSON.stringify({ symbol: 'X' }));
    expect(readSavedSession()).toBeNull();
  });

  it('does not persist an invalid session', () => {
    saveSession({ ...STARTER, timeframe: 'bogus' } as unknown as ChartControlsValue);
    expect(readSavedSession()).toBeNull();
  });
});

describe('initial session resolution', () => {
  it('prefers complete URL parameters over everything else', () => {
    const params = new URLSearchParams({
      symbol: 'NQZ4',
      timeframe: '15m',
      start: '2024-12-02T14:30',
      end: '2024-12-02T21:00',
    });
    const { session, source } = resolveInitialSession(params, STARTER, SAVED);
    expect(source).toBe('url');
    expect(session.symbol).toBe('NQZ4');
  });

  it('falls back to the saved session when the URL is incomplete', () => {
    const params = new URLSearchParams({ symbol: 'NQZ4' });
    const { session, source } = resolveInitialSession(params, STARTER, SAVED);
    expect(source).toBe('saved');
    expect(session).toEqual(SAVED);
  });

  it('falls back to the starter session when nothing valid is available', () => {
    expect(resolveInitialSession(null, STARTER, null)).toEqual({
      session: STARTER,
      source: 'starter',
    });
  });

  it('falls back safely when the saved session is invalid', () => {
    const invalid = { ...SAVED, start: 'nonsense' } as ChartControlsValue;
    const { session, source } = resolveInitialSession(null, STARTER, invalid);
    expect(source).toBe('starter');
    expect(session).toEqual(STARTER);
  });

  it('ignores invalid URL parameters rather than requesting them', () => {
    const params = new URLSearchParams({
      symbol: 'NQZ4',
      timeframe: 'nope',
      start: '2024-12-02T14:30',
      end: '2024-12-02T21:00',
    });
    expect(resolveInitialSession(params, STARTER, null).source).toBe('starter');
  });
});
