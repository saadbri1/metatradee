/**
 * Last successful chart session, persisted so /chart opens on real candles
 * instead of an empty workspace.
 *
 * Only SAFE session metadata is stored — contract, timeframe, and the UTC
 * range. No provider key, no credentials, no candle payload ever touches
 * storage. Values are validated on read, so a stale or hand-edited entry can
 * never force an invalid request; it simply falls back to the starter session.
 */
import type { ChartControlsValue } from './components/chart-controls';

const STORAGE_KEY = 'metatradee-chart-session';

/** `datetime-local` shape the controls use: YYYY-MM-DDTHH:mm */
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const TIMEFRAMES = new Set(['1m', '5m', '15m', '1h']);

export function isValidSession(value: unknown): value is ChartControlsValue {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.symbol !== 'string' || v.symbol.trim().length === 0 || v.symbol.length > 12) {
    return false;
  }
  if (typeof v.timeframe !== 'string' || !TIMEFRAMES.has(v.timeframe)) return false;
  if (typeof v.start !== 'string' || !LOCAL_DATETIME.test(v.start)) return false;
  if (typeof v.end !== 'string' || !LOCAL_DATETIME.test(v.end)) return false;
  // An inverted or empty range would always fail upstream — reject it here.
  return v.start < v.end;
}

/** Read the saved session, or null when absent/invalid/unavailable. */
export function readSavedSession(): ChartControlsValue | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isValidSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Persist a session that actually loaded. Never throws. */
export function saveSession(session: ChartControlsValue): void {
  if (typeof window === 'undefined') return;
  try {
    if (!isValidSession(session)) return;
    const safe: ChartControlsValue = {
      symbol: session.symbol,
      timeframe: session.timeframe,
      start: session.start,
      end: session.end,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  } catch {
    // Storage can be unavailable (private mode, quota) — never break the chart.
  }
}

/**
 * Resolve the session to load on open, in priority order:
 *   1. URL parameters (a shared or deep-linked session wins)
 *   2. the last successfully loaded session
 *   3. the verified historical starter session
 */
export function resolveInitialSession(
  params: URLSearchParams | null,
  starter: ChartControlsValue,
  saved: ChartControlsValue | null = readSavedSession(),
): { session: ChartControlsValue; source: 'url' | 'saved' | 'starter' } {
  const fromUrl = {
    symbol: params?.get('symbol') ?? undefined,
    timeframe: params?.get('timeframe') ?? undefined,
    start: params?.get('start') ?? undefined,
    end: params?.get('end') ?? undefined,
  };
  if (fromUrl.symbol && fromUrl.timeframe && fromUrl.start && fromUrl.end) {
    const candidate = {
      symbol: fromUrl.symbol,
      timeframe: fromUrl.timeframe,
      start: fromUrl.start,
      end: fromUrl.end,
    };
    if (isValidSession(candidate)) return { session: candidate, source: 'url' };
  }
  if (saved && isValidSession(saved)) return { session: saved, source: 'saved' };
  return { session: starter, source: 'starter' };
}
