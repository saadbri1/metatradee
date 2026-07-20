import { describe, it, expect } from 'vitest';
import { isNavItemActive, activeNavLabel, NAV_ITEMS, ALL_NAV_ITEMS } from '@/features/shell/nav';
import { PROTECTED_PREFIXES } from '@/features/auth/config';

describe('isNavItemActive', () => {
  it('matches exact and nested routes by base segment', () => {
    expect(isNavItemActive('/dashboard', '/dashboard')).toBe(true);
    expect(isNavItemActive('/journal/trade-123', '/journal')).toBe(true);
    expect(isNavItemActive('/settings/profile', '/settings/profile')).toBe(true);
    expect(isNavItemActive('/settings/preferences', '/settings/profile')).toBe(true); // same /settings base
  });
  it('does not match unrelated routes', () => {
    expect(isNavItemActive('/analytics', '/journal')).toBe(false);
    expect(isNavItemActive('/dashboard', '/journal')).toBe(false);
  });
});

describe('activeNavLabel', () => {
  it('returns the section label, or a fallback', () => {
    expect(activeNavLabel('/journal')).toBe('Journal');
    expect(activeNavLabel('/settings/preferences')).toBe('Settings');
    expect(activeNavLabel('/nowhere')).toBe('MetaTradee');
  });
});

describe('nav registries', () => {
  it('have unique ids and hrefs', () => {
    const ids = ALL_NAV_ITEMS.map((i) => i.id);
    const hrefs = ALL_NAV_ITEMS.map((i) => i.href);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(NAV_ITEMS[0]?.href).toBe('/dashboard'); // status-first
  });

  it('every nav destination is covered by the middleware protected prefixes', () => {
    // Regression guard: /chart shipped in the nav WITHOUT a matching protected
    // prefix, so the middleware never saw it and login redirects lost the
    // return path (next=/dashboard instead of next=/chart). A nav item whose
    // href no protected prefix covers is a config gap, not a choice.
    const prefixes = PROTECTED_PREFIXES as readonly string[];
    for (const item of ALL_NAV_ITEMS) {
      const covered = prefixes.some((p) => item.href === p || item.href.startsWith(`${p}/`));
      expect(covered, `${item.href} missing from PROTECTED_PREFIXES`).toBe(true);
    }
  });
});
