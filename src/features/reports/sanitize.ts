/**
 * Output sanitization for generated files. Two distinct threats:
 *  1. CSV/Excel FORMULA INJECTION — a cell beginning with = + - @ (or tab/CR)
 *     is executed as a formula by spreadsheet apps. We neutralize by prefixing a
 *     single quote and stripping leading control chars, per OWASP guidance.
 *  2. XSS in PDF/HTML — user notes/attachments rendered into markup must be HTML-
 *     escaped so injected tags cannot execute.
 * These run on EVERY user-supplied value that reaches a file or share.
 */

const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

/** Neutralize a single CSV/Excel cell value against formula injection. */
export function neutralizeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Prefix a quote if the value could be interpreted as a formula. Also guards
  // values like "=cmd" and "@SUM" and leading tab/CR smuggling.
  const guarded = FORMULA_TRIGGERS.test(s) ? `'${s}` : s;
  return guarded;
}

/** RFC-4180 CSV field: quote when needed, escape embedded quotes, after neutralizing. */
export function csvField(value: unknown): string {
  const cell = neutralizeCell(value);
  if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape a value for safe interpolation into HTML/PDF markup. */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}
