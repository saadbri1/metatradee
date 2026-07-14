/**
 * Username rules — pure + unit-testable. Enforced in the Zod schema (client +
 * server) and re-checked server-side against a live availability query.
 */
import { RESERVED_USERNAMES } from '../config';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;
// Lowercase letter first; then letters/digits/underscore; no trailing underscore.
export const USERNAME_REGEX = /^[a-z][a-z0-9_]{1,30}[a-z0-9]$/;

/** Normalize for storage/comparison: trim + lowercase. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function isReservedUsername(input: string): boolean {
  return RESERVED_USERNAMES.has(normalizeUsername(input));
}

/** Full validity check used by the schema (shape + reserved). */
export function isValidUsername(input: string): boolean {
  const value = normalizeUsername(input);
  if (value.length < USERNAME_MIN || value.length > USERNAME_MAX) return false;
  if (!USERNAME_REGEX.test(value)) return false;
  if (isReservedUsername(value)) return false;
  return true;
}
