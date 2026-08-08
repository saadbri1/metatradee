/**
 * The runtime privacy guard. PURE.
 *
 * WHY THIS EXISTS WHEN THE TYPES ALREADY FORBID IT. Types are erased at build
 * time. A JavaScript caller, a stale bundle, an `as never`, or a future edit
 * that widens a payload type all get past the compiler and reach this function.
 * Since what is at stake is a stranger's account balance leaving their browser,
 * the check is repeated where it can actually run.
 *
 * IT DROPS RATHER THAN THROWS IN PRODUCTION. An analytics call must never break
 * a page — least of all a calculator someone is mid-way through. In development
 * it is loud, so the mistake is found before it ships.
 *
 * NUMBERS ARE REFUSED CATEGORICALLY. Not "large numbers", not "numbers that
 * look monetary" — all of them. Every legitimate property in this system is a
 * value from a fixed enum, so a number arriving here means something has gone
 * wrong, and every quantity this product handles is financial.
 */
import { EVENT_SCHEMA, FORBIDDEN_KEY_FRAGMENTS, type AnalyticsEventName } from './events';

/** Longest a property value may be. Enum members are short; prose is not. */
const MAX_VALUE_LENGTH = 64;

export interface SanitizeResult {
  /** Safe to send. Contains only keys the event's schema declares. */
  props: Record<string, string | boolean>;
  /** Why something was removed. Empty when the payload was already clean. */
  dropped: string[];
}

function isForbiddenKey(key: string): boolean {
  const lower = key.toLowerCase();
  return FORBIDDEN_KEY_FRAGMENTS.some((fragment) => lower.includes(fragment));
}

/**
 * Reduce a payload to exactly what its event is allowed to carry.
 *
 * Unknown keys, forbidden keys, and any value that is not a short string or a
 * boolean are removed — never coerced. Coercing a number to a string would
 * defeat the whole point.
 */
export function sanitizeProps(
  name: AnalyticsEventName,
  props: Readonly<Record<string, unknown>>,
): SanitizeResult {
  const allowed = EVENT_SCHEMA[name];
  const safe: Record<string, string | boolean> = {};
  const dropped: string[] = [];

  for (const [key, value] of Object.entries(props ?? {})) {
    if (!allowed.includes(key)) {
      dropped.push(`${key}: not declared for ${name}`);
      continue;
    }
    if (isForbiddenKey(key)) {
      // Reachable only if a schema itself is edited to allow a forbidden key.
      dropped.push(`${key}: forbidden key name`);
      continue;
    }
    if (typeof value === 'boolean') {
      safe[key] = value;
      continue;
    }
    if (typeof value !== 'string') {
      // Numbers land here, deliberately. So do objects, arrays and null.
      dropped.push(`${key}: ${typeof value} is not an allowed value type`);
      continue;
    }
    if (value.length > MAX_VALUE_LENGTH) {
      dropped.push(`${key}: value too long to be an enum member`);
      continue;
    }
    safe[key] = value;
  }

  return { props: safe, dropped };
}

/**
 * True when a payload would survive sanitisation untouched.
 *
 * Used by the tests and by the development-time warning — it answers "was this
 * call already correct", which is a different question from "what is safe to
 * send".
 */
export function isCleanPayload(
  name: AnalyticsEventName,
  props: Readonly<Record<string, unknown>>,
): boolean {
  return sanitizeProps(name, props).dropped.length === 0;
}
