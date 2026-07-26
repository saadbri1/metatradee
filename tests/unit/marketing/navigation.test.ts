import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  allNavHrefs,
  HEADER_ORDER,
  NAV_LINKS,
  NAV_MENUS,
  PRODUCT_ITEMS,
  PUBLIC_ROUTES,
  RESOURCE_ITEMS,
  SOLUTION_ITEMS,
} from '@/features/marketing/navigation';

const APP_ROOT = resolve(__dirname, '../../../src/app');

/** Does a real route file back this path? */
function routeExists(path: string): boolean {
  const segment = path === '/' ? '' : path.replace(/^\//, '');
  return (
    existsSync(resolve(APP_ROOT, segment, 'page.tsx')) ||
    // Auth routes live in the (auth) route group.
    existsSync(resolve(APP_ROOT, '(auth)', segment, 'page.tsx'))
  );
}

describe('public navigation contract', () => {
  it('exposes exactly the five primary header entries, in order', () => {
    const rendered = [
      NAV_MENUS[0]!.label,
      NAV_MENUS[1]!.label,
      ...NAV_LINKS.map((l) => l.label),
      NAV_MENUS[2]!.label,
    ];
    expect(rendered).toEqual([...HEADER_ORDER]);
  });

  it('gives Products, Solutions and Resources a dropdown with real items', () => {
    expect(NAV_MENUS.map((m) => m.label)).toEqual(['Products', 'Solutions', 'Resources']);
    for (const menu of NAV_MENUS) {
      expect(menu.items.length).toBeGreaterThanOrEqual(8);
      expect(menu.href).toMatch(/^\//);
    }
  });

  it('names every shipped product surface', () => {
    expect(PRODUCT_ITEMS.map((i) => i.label)).toEqual([
      'Trading Dashboard',
      'Trading Journal',
      'Trade Analytics',
      'Chart & Replay',
      'Playbooks',
      'AI Coach',
      'Calendar',
      'Reports',
    ]);
    // Every product entry carries an icon, a description and a destination.
    for (const item of PRODUCT_ITEMS) {
      expect(item.icon).toBeTruthy();
      expect(item.description.length).toBeGreaterThan(10);
      expect(item.href).toMatch(/^\/products#/);
    }
  });

  it('covers the required solution segments and workflows', () => {
    expect(SOLUTION_ITEMS.map((i) => i.label)).toEqual([
      'Active Traders',
      'Futures Traders',
      'Funded Traders',
      'Trading Coaches',
      'Trading Teams',
      'Demo & Replay Practice',
      'Performance Review',
      'Strategy Development',
    ]);
  });

  it('covers the required resources', () => {
    expect(RESOURCE_ITEMS.map((i) => i.label)).toEqual([
      'Trading Journal Guide',
      'Replay Guide',
      'Analytics Guide',
      'Playbook Guide',
      'AI Coach Guide',
      'Help Center',
      'Product Updates',
      'Security & Privacy',
      'Contact',
    ]);
  });
});

describe('no dead destinations', () => {
  it('backs every navigation href with a real route file', () => {
    const missing = allNavHrefs()
      .map((href) => href.split('#')[0]!)
      .filter((path, index, all) => all.indexOf(path) === index)
      .filter((path) => !routeExists(path));
    expect(missing).toEqual([]);
  });

  it('creates every public route the header promises', () => {
    for (const route of PUBLIC_ROUTES) {
      expect(routeExists(route), `${route} has no page.tsx`).toBe(true);
    }
  });

  it('never points at a placeholder, an anchor-only link, or an external stub', () => {
    for (const href of allNavHrefs()) {
      expect(href).toMatch(/^\//); // internal routes only
      expect(href).not.toMatch(/^#/); // no bare anchors in the header
      expect(href).not.toMatch(/#$|\/#/); // no empty fragments
      expect(href.toLowerCase()).not.toMatch(/todo|placeholder|coming-soon|example\.com/);
    }
  });

  it('routes Log in and Get Started at the real auth flows', () => {
    const hrefs = allNavHrefs();
    expect(hrefs).toContain('/login');
    expect(hrefs).toContain('/register');
    expect(routeExists('/login')).toBe(true);
    expect(routeExists('/register')).toBe(true);
  });
});
