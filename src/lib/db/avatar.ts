/**
 * Avatar upload constraints + pure validators. Used client-side for UX and
 * re-run server-side authoritatively (never trust the client). No DOM/Node deps
 * so it runs in both environments and is unit-testable.
 */
export const AVATAR_ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export type AvatarMime = (typeof AVATAR_ALLOWED_MIME)[number];

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MB (matches bucket limit)
export const AVATAR_MAX_DIMENSION = 4096; // px, longest side
export const AVATAR_MIN_DIMENSION = 32; // px

export type AvatarValidation = { ok: true } | { ok: false; error: string };

const MIME_EXTENSION: Record<AvatarMime, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function isAllowedAvatarMime(mime: string): mime is AvatarMime {
  return (AVATAR_ALLOWED_MIME as readonly string[]).includes(mime);
}

/** File extension for an allowed avatar mime type. */
export function avatarExtension(mime: AvatarMime): string {
  return MIME_EXTENSION[mime];
}

/** Validate type + size (dimensions checked separately once decoded). */
export function validateAvatarFile(input: { type: string; size: number }): AvatarValidation {
  if (!isAllowedAvatarMime(input.type)) {
    return { ok: false, error: 'Unsupported image type. Use PNG, JPEG, WEBP, or GIF.' };
  }
  if (input.size <= 0) {
    return { ok: false, error: 'File is empty.' };
  }
  if (input.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: 'Image is too large (max 5 MB).' };
  }
  return { ok: true };
}

/** Validate decoded image dimensions. */
export function validateAvatarDimensions(width: number, height: number): AvatarValidation {
  if (width < AVATAR_MIN_DIMENSION || height < AVATAR_MIN_DIMENSION) {
    return { ok: false, error: `Image is too small (min ${AVATAR_MIN_DIMENSION}px).` };
  }
  if (width > AVATAR_MAX_DIMENSION || height > AVATAR_MAX_DIMENSION) {
    return { ok: false, error: `Image is too large (max ${AVATAR_MAX_DIMENSION}px).` };
  }
  return { ok: true };
}
