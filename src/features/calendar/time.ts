/**
 * Timezone-correct time bucketing — the first-class requirement of this module.
 * Every day/hour/weekday/month bucket is derived from a UTC timestamp rendered
 * in the USER'S timezone via Intl (which is DST-correct). Because bucketing only
 * changes WHICH bucket a trade lands in — never its net_pnl — totals reconcile
 * exactly with analytics regardless of timezone.
 *
 * Rule: a trade's calendar day/hour/session is its `closed_at` in the user tz.
 * A trade therefore appears on exactly one day.
 */

export interface TzParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  weekday: number; // 0=Sun..6=Sat
  dateKey: string; // YYYY-MM-DD in user tz
}

const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Render a UTC ISO timestamp into calendar parts in `tz` (DST-correct). */
export function tzParts(iso: string, tz: string): TzParts | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    });
  } catch {
    // Invalid tz → fall back to UTC.
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    });
  }
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  let hour = Number(get('hour'));
  if (hour === 24) hour = 0; // some engines emit 24 at midnight
  const weekday = WEEKDAYS[get('weekday')] ?? 0;
  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, hour, weekday, dateKey };
}

export const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Add days to a YYYY-MM-DD key (UTC-noon math avoids DST edge shifts). */
export function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive day difference between two YYYY-MM-DD keys. */
export function dayDiff(a: string, b: string): number {
  const da = new Date(`${a}T12:00:00Z`).getTime();
  const db = new Date(`${b}T12:00:00Z`).getTime();
  return Math.round((db - da) / 86_400_000);
}
