/**
 * Storage path helpers. Every object path is scoped under the owner's user id as
 * the FIRST segment (`{userId}/...`), which is exactly what the storage RLS
 * policies enforce. Client-supplied names are never trusted: only the basename
 * is used and it is sanitized. Pure + unit-testable.
 */

/** Reduce any client string to a safe, single path segment (no traversal). */
export function sanitizeSegment(name: string): string {
  // Take the basename (strip any directory components, forward or back slashes).
  const base = name.split(/[/\\]/).pop() ?? '';
  // Allow word chars, dot, and dash; collapse everything else to a dash.
  const cleaned = base.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned.length > 0 ? cleaned.slice(0, 128) : 'file';
}

/** Build an owner-scoped object path: `${userId}/${safeName}`. */
export function userScopedPath(userId: string, fileName: string): string {
  if (!userId) throw new Error('userScopedPath: userId is required');
  return `${userId}/${sanitizeSegment(fileName)}`;
}

/**
 * Avatar object path. Includes a caller-provided unique token so a new upload
 * never collides with the old file (old row/object is deleted separately —
 * replace-old-on-new).
 */
export function avatarPath(userId: string, uniqueToken: string, extension: string): string {
  const ext = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
  const token = sanitizeSegment(uniqueToken);
  return `${userId}/avatar-${token}.${ext}`;
}
