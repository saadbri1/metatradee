/**
 * The public footer, as an internal-linking surface.
 *
 * WHY THIS IS TESTED AT ALL. The footer is the only site-wide link every public
 * page carries, so it decides which URLs are reachable from everywhere and
 * which depend on a header dropdown. Nine standalone indexable pages — the
 * acquisition hubs, the calculators and the MetaTrader importers — reached it
 * through neither before, and an unlinked page is one navigation redesign from
 * being an orphan.
 *
 * The opposite failure is a link farm, so the shape is asserted too: bounded
 * columns, no duplicate anchors, and every href a real registered route.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

import { MarketingFooter } from '@/features/marketing/components/footer';
import { SEO_PAGES, indexablePages } from '@/config/seo';

function hrefs(): string[] {
  const { container } = render(<MarketingFooter />);
  return Array.from(container.querySelectorAll('a[href]')).map((a) => a.getAttribute('href')!);
}

/** A footer href with any `#fragment` removed. */
function toPath(href: string): string {
  return href.split('#')[0] || '/';
}

describe('every footer link goes somewhere real', () => {
  it('points only at paths in the SEO registry', () => {
    const registered = new Set(SEO_PAGES.map((p) => p.path as string));
    for (const href of hrefs()) {
      expect(href.startsWith('/'), `${href} is not an internal path`).toBe(true);
      expect(registered.has(toPath(href)), `${href} is not a registered route`).toBe(true);
    }
  });

  it('lists no href twice', () => {
    const all = hrefs();
    expect(new Set(all).size, `duplicate anchors: ${all.join(', ')}`).toBe(all.length);
  });
});

describe('the pages that would otherwise be orphans', () => {
  /*
   * The three calculators are the highest-intent public entry points on the
   * site and had no footer link at all. The hubs and importers are the pages
   * non-brand search lands on.
   */
  const MUST_REACH = [
    '/tools',
    '/tools/position-size-calculator',
    '/tools/xauusd-lot-size-calculator',
    '/tools/risk-reward-calculator',
    '/trading-journal',
    '/ai-trading-journal',
    '/free-trading-journal',
    '/integrations/metatrader-5',
    '/integrations/metatrader-4',
  ];

  it.each(MUST_REACH)('links to %s from every page', (path) => {
    expect(hrefs()).toContain(path);
  });

  it('reaches every standalone indexable page without a fragment', () => {
    /*
     * Fragment-only coverage does not count: `/products#journal` links
     * `/products`, not the section. Pages that legitimately live as anchors on
     * another page are excluded by checking only registry paths of depth ≥ 1
     * that own a route of their own.
     */
    const linked = new Set(hrefs().map(toPath));
    const unreachable = indexablePages()
      .map((p) => p.path as string)
      .filter((path) => path !== '/' && !linked.has(path));

    expect(unreachable, `not reachable from the footer: ${unreachable.join(', ')}`).toEqual([]);
  });
});

describe('it is navigation, not a keyword farm', () => {
  it('keeps every column to five links or fewer', () => {
    const { container } = render(<MarketingFooter />);
    for (const nav of Array.from(container.querySelectorAll('nav'))) {
      const count = nav.querySelectorAll('a').length;
      const label = nav.getAttribute('aria-label');
      expect(count, `${label} has ${count} links`).toBeLessThanOrEqual(5);
    }
  });

  it('gives each column a labelled nav landmark and a heading', () => {
    const { container } = render(<MarketingFooter />);
    const navs = Array.from(container.querySelectorAll('nav'));
    expect(navs.length).toBeGreaterThan(0);
    for (const nav of navs) {
      const label = nav.getAttribute('aria-label');
      expect(label, 'unlabelled nav landmark').toBeTruthy();
      expect(within(nav as HTMLElement).getByRole('heading')).toHaveTextContent(label!);
    }
  });

  it('reserves one grid track per column plus two for the brand', () => {
    /*
     * The count is written in a Tailwind class and cannot be derived at
     * runtime (CSS `repeat()` rejects a custom property), so it is pinned here
     * instead: add a column to the array and this fails until the class agrees.
     */
    const { container } = render(<MarketingFooter />);
    const grid = container.querySelector('.lg\\:grid-cols-7');
    const columns = container.querySelectorAll('nav').length;
    expect(grid, 'the footer grid class changed without this test').not.toBeNull();
    expect(columns + 2).toBe(7);
  });
});

describe('anchor text describes the destination', () => {
  it('uses the page name rather than a bare keyword string', () => {
    render(<MarketingFooter />);
    for (const label of ['All calculators', 'Position size calculator', 'Trading journal']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });
});
