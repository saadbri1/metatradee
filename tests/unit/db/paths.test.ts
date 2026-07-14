import { describe, it, expect } from 'vitest';
import { sanitizeSegment, userScopedPath, avatarPath } from '@/lib/db/paths';

describe('sanitizeSegment', () => {
  it('reduces to a safe basename', () => {
    expect(sanitizeSegment('photo.png')).toBe('photo.png');
  });
  it('strips directory traversal (forward and back slashes)', () => {
    expect(sanitizeSegment('../../etc/passwd')).toBe('passwd');
    expect(sanitizeSegment('..\\..\\windows\\system32')).toBe('system32');
  });
  it('replaces unsafe characters and never returns empty', () => {
    expect(sanitizeSegment('a b*c?.png')).toBe('a-b-c-.png');
    expect(sanitizeSegment('///')).toBe('file');
  });
});

describe('userScopedPath', () => {
  it('scopes the path under the user id', () => {
    expect(userScopedPath('user-1', 'photo.png')).toBe('user-1/photo.png');
  });
  it('cannot escape the user folder via traversal input', () => {
    const path = userScopedPath('user-1', '../../../secret.png');
    expect(path).toBe('user-1/secret.png');
    expect(path.startsWith('user-1/')).toBe(true);
  });
  it('throws without a user id', () => {
    expect(() => userScopedPath('', 'x.png')).toThrow();
  });
});

describe('avatarPath', () => {
  it('builds an owner-scoped avatar path with a sanitized extension', () => {
    const path = avatarPath('user-1', 'abc123', 'PNG');
    expect(path).toBe('user-1/avatar-abc123.png');
  });
  it('keeps the first segment equal to the user id', () => {
    const path = avatarPath('user-1', '../evil', 'jpg');
    expect(path.split('/')[0]).toBe('user-1');
  });
});
