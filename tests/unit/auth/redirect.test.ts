import { describe, it, expect } from 'vitest';
import { sanitizeRedirect } from '@/features/auth/lib/redirect';

describe('sanitizeRedirect', () => {
  it('allows plain internal paths', () => {
    expect(sanitizeRedirect('/account')).toBe('/account');
    expect(sanitizeRedirect('/account/settings?tab=security')).toBe(
      '/account/settings?tab=security',
    );
  });

  it('falls back for empty/nullish input', () => {
    expect(sanitizeRedirect(undefined)).toBe('/');
    expect(sanitizeRedirect(null)).toBe('/');
    expect(sanitizeRedirect('')).toBe('/');
  });

  it('honors a custom fallback', () => {
    expect(sanitizeRedirect(undefined, '/login')).toBe('/login');
    expect(sanitizeRedirect('https://evil.com', '/login')).toBe('/login');
  });

  it('rejects absolute and protocol-relative URLs', () => {
    expect(sanitizeRedirect('https://evil.com')).toBe('/');
    expect(sanitizeRedirect('http://evil.com')).toBe('/');
    expect(sanitizeRedirect('//evil.com')).toBe('/');
    expect(sanitizeRedirect('/\\evil.com')).toBe('/');
  });

  it('rejects scheme and javascript payloads', () => {
    expect(sanitizeRedirect('javascript:alert(1)')).toBe('/');
    expect(sanitizeRedirect('/http://evil.com')).toBe('/');
    expect(sanitizeRedirect('/javascript:alert(1)')).toBe('/');
  });

  it('rejects encoded traversal tricks', () => {
    expect(sanitizeRedirect('/%2F%2Fevil.com')).toBe('/'); // encoded //
    expect(sanitizeRedirect('/%5Cevil.com')).toBe('/'); // encoded backslash
  });

  it('rejects control characters', () => {
    expect(sanitizeRedirect('/foo\nbar')).toBe('/');
    expect(sanitizeRedirect('/foo\tbar')).toBe('/');
  });
});
