/**
 * Open-redirect protection. Every post-auth "next" target passes through
 * `sanitizeRedirect`, which allowlists **internal, same-origin path** targets
 * only. Pure function (no imports) → safe in Edge middleware, server, client.
 */

// Control characters (NUL–US) and backslash are never valid in a safe path.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\x00-\x1f\\]/;
// A scheme immediately after the leading slash, e.g. "/http://evil" or
// "/javascript:alert" — treated as a would-be absolute/dangerous URL.
const LEADING_SCHEME = /^\/[a-z][a-z0-9+.-]*:/i;

function isSafeCandidate(value: string): boolean {
  if (value[0] !== '/') return false; // must be an absolute in-app path
  if (value[1] === '/' || value[1] === '\\') return false; // protocol-relative
  if (UNSAFE_CHARS.test(value)) return false;
  if (LEADING_SCHEME.test(value)) return false;
  return true;
}

/**
 * Returns a safe internal path, or `fallback` if the input is missing, external,
 * protocol-relative, or otherwise not a plain in-app path. Both the raw and the
 * decoded form must pass, catching percent-encoded "//"/"\"/scheme tricks.
 */
export function sanitizeRedirect(target: string | null | undefined, fallback = '/'): string {
  if (typeof target !== 'string' || target.length === 0) return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    return fallback;
  }

  if (!isSafeCandidate(target) || !isSafeCandidate(decoded)) return fallback;
  return target;
}
