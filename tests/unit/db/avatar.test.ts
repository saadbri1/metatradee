import { describe, it, expect } from 'vitest';
import {
  validateAvatarFile,
  validateAvatarDimensions,
  avatarExtension,
  isAllowedAvatarMime,
  AVATAR_MAX_BYTES,
} from '@/lib/db/avatar';

describe('isAllowedAvatarMime / avatarExtension', () => {
  it('recognizes allowed types and maps extensions', () => {
    expect(isAllowedAvatarMime('image/png')).toBe(true);
    expect(isAllowedAvatarMime('image/svg+xml')).toBe(false);
    expect(avatarExtension('image/jpeg')).toBe('jpg');
    expect(avatarExtension('image/webp')).toBe('webp');
  });
});

describe('validateAvatarFile', () => {
  it('accepts a valid image', () => {
    expect(validateAvatarFile({ type: 'image/png', size: 1024 })).toEqual({
      ok: true,
    });
  });
  it('rejects disallowed types', () => {
    expect(validateAvatarFile({ type: 'application/pdf', size: 1024 }).ok).toBe(false);
    expect(validateAvatarFile({ type: 'image/svg+xml', size: 1024 }).ok).toBe(false);
  });
  it('rejects empty and oversized files', () => {
    expect(validateAvatarFile({ type: 'image/png', size: 0 }).ok).toBe(false);
    expect(validateAvatarFile({ type: 'image/png', size: AVATAR_MAX_BYTES + 1 }).ok).toBe(false);
  });
});

describe('validateAvatarDimensions', () => {
  it('accepts in-range dimensions', () => {
    expect(validateAvatarDimensions(512, 512)).toEqual({ ok: true });
  });
  it('rejects too-small and too-large images', () => {
    expect(validateAvatarDimensions(8, 8).ok).toBe(false);
    expect(validateAvatarDimensions(5000, 5000).ok).toBe(false);
  });
});
