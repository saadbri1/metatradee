/**
 * Trading-session definitions + assignment. Sessions are anchored to UTC market
 * hours (documented boundaries; adjust to FRS). Session ANALYSIS windows are
 * intentionally NON-exclusive — the London/NY overlap deliberately double-counts
 * trades that are also in London and New York — so per-session nets do not sum
 * to the total (documented). A trade's PRIMARY session (used where exclusivity
 * matters) prefers the stored 9.6 `session` field, else the first matching
 * non-overlap window by priority.
 */
import type { TradeSession } from '@/features/journal/enums';

export type SessionId = 'sydney' | 'asian' | 'london' | 'new_york' | 'overlap';

export interface SessionDef {
  id: SessionId;
  label: string;
  startUtc: number; // inclusive hour
  endUtc: number; // exclusive hour (window wraps midnight when start > end)
}

export const SESSIONS: readonly SessionDef[] = [
  { id: 'sydney', label: 'Sydney', startUtc: 21, endUtc: 6 },
  { id: 'asian', label: 'Asian (Tokyo)', startUtc: 0, endUtc: 9 },
  { id: 'london', label: 'London', startUtc: 7, endUtc: 16 },
  { id: 'new_york', label: 'New York', startUtc: 12, endUtc: 21 },
  { id: 'overlap', label: 'London/NY overlap', startUtc: 12, endUtc: 16 },
] as const;

// Exclusive-assignment priority (overlap excluded — it's an analysis window).
const PRIMARY_PRIORITY: SessionId[] = ['london', 'new_york', 'asian', 'sydney'];

export function utcHour(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.getUTCHours();
}

export function inWindow(hour: number, def: SessionDef): boolean {
  return def.startUtc <= def.endUtc
    ? hour >= def.startUtc && hour < def.endUtc
    : hour >= def.startUtc || hour < def.endUtc;
}

/** Every session window a trade's close-hour falls in (overlap included). */
export function sessionMembership(iso: string | null): SessionId[] {
  const h = utcHour(iso);
  if (h === null) return [];
  return SESSIONS.filter((s) => inWindow(h, s)).map((s) => s.id);
}

/** Single exclusive session for a trade: stored field wins, else derived. */
export function primarySession(iso: string | null, stored: TradeSession | null): SessionId | null {
  if (stored) return stored as SessionId;
  const h = utcHour(iso);
  if (h === null) return null;
  for (const id of PRIMARY_PRIORITY) {
    const def = SESSIONS.find((s) => s.id === id)!;
    if (inWindow(h, def)) return id;
  }
  return null;
}
