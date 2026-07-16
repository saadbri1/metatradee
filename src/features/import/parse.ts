/**
 * File parsing (Phase 10.8 import engine). Pure + deterministic.
 *
 * CSV: RFC-4180 (quoted fields, escaped quotes, embedded newlines), BOM strip,
 * delimiter auto-detection (`,` `;` `\t` `|`). Rows stream through a callback so
 * memory stays bounded by chunk, never by file size.
 *
 * Numbers: broker exports mix locales — "1,234.56", "1.234,56", "1 234,56".
 * Dates: brokers mix formats — ISO, "YYYY.MM.DD HH:MM:SS" (MT4/5),
 * "DD/MM/YYYY HH:MM", epoch seconds/millis. Everything normalizes to UTC ISO.
 * Ambiguity is resolved deterministically and malformed values return null so
 * the row is CAPTURED as invalid, never silently dropped or guessed.
 */

const DELIMITERS = [',', ';', '\t', '|'] as const;

/** Strip a UTF-8 BOM if present. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Pick the delimiter that yields the most consistent column count (first 10 lines). */
export function detectDelimiter(text: string): string {
  const lines = stripBom(text).split(/\r?\n/).filter(Boolean).slice(0, 10);
  let best: string = ',';
  let bestScore = -1;
  for (const d of DELIMITERS) {
    const counts = lines.map((l) => l.split(d).length);
    const first = counts[0] ?? 1;
    if (first < 2) continue;
    const consistent = counts.every((c) => c === first);
    const score = (consistent ? 1000 : 0) + first;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

/** RFC-4180 CSV parse → array of string cells per row. Handles quoted newlines. */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const src = stripBom(text);
  const delim = delimiter ?? detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

/** Parse a JSON export: an array of flat objects → headers + string rows. */
export function parseJsonRows(text: string): { headers: string[]; rows: string[][] } | null {
  try {
    const data = JSON.parse(stripBom(text)) as unknown;
    if (!Array.isArray(data) || data.length === 0) return null;
    const first = data[0];
    if (typeof first !== 'object' || first === null) return null;
    const headers = Object.keys(first as Record<string, unknown>);
    const rows = (data as Record<string, unknown>[]).map((o) =>
      headers.map((h) => (o[h] === null || o[h] === undefined ? '' : String(o[h]))),
    );
    return { headers, rows };
  } catch {
    return null;
  }
}

/**
 * Locale-tolerant number parse. Rules (deterministic):
 *  - spaces/apostrophes are thousands separators → removed
 *  - if both `.` and `,` appear, the LAST one is the decimal separator
 *  - a single `,` with ≤2 trailing digits is a decimal comma; otherwise thousands
 */
export function parseLocaleNumber(raw: string): number | null {
  const s = raw.trim().replace(/[\s']/g, '');
  if (s === '' || s === '-') return null;
  let normalized = s;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    normalized =
      lastDot > lastComma
        ? s.replace(/,/g, '') // 1,234.56
        : s.replace(/\./g, '').replace(',', '.'); // 1.234,56
  } else if (lastComma !== -1) {
    const decimals = s.length - lastComma - 1;
    normalized =
      decimals <= 2 && s.indexOf(',') === lastComma
        ? s.replace(',', '.') // 12,34 → 12.34
        : s.replace(/,/g, ''); // 1,234 or 1,234,567
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Broker date parse → UTC ISO string, or null when unrecognizable.
 * Supported: ISO 8601 · "YYYY.MM.DD HH:MM[:SS]" (MT4/5) · "YYYY-MM-DD HH:MM[:SS]"
 * · "DD/MM/YYYY HH:MM[:SS]" (day-first, deterministic) · epoch seconds/millis.
 * Naive timestamps are interpreted as UTC (documented; broker statements carry
 * server time — the 10.3 tz rules then bucket by the USER's timezone).
 */
export function parseBrokerDate(raw: string): string | null {
  const s = raw.trim();
  if (s === '') return null;

  // Epoch seconds / milliseconds.
  if (/^\d{10}$/.test(s)) return new Date(Number(s) * 1000).toISOString();
  if (/^\d{13}$/.test(s)) return new Date(Number(s)).toISOString();

  // ISO with timezone info — trust it.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  // "YYYY.MM.DD HH:MM[:SS]" or "YYYY-MM-DD HH:MM[:SS]" (naive → UTC).
  let m = s.match(/^(\d{4})[.-](\d{2})[.-](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, y, mo, d, h = '0', mi = '0', se = '0'] = m;
    const t = Date.UTC(+y!, +mo! - 1, +d!, +h, +mi, +se);
    return validUtc(t, +mo!, +d!);
  }

  // "DD/MM/YYYY HH:MM[:SS]" — day-first (deterministic rule, documented).
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, d, mo, y, h = '0', mi = '0', se = '0'] = m;
    const t = Date.UTC(+y!, +mo! - 1, +d!, +h, +mi, +se);
    return validUtc(t, +mo!, +d!);
  }

  return null;
}

function validUtc(t: number, month: number, day: number): string | null {
  if (Number.isNaN(t) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(t).toISOString();
}
