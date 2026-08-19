import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { BrandLockup } from './brand-mark';

/**
 * Public footer. Links point at the real public routes the header exposes, so
 * the footer cannot become a graveyard of anchors to sections that moved off
 * the homepage.
 *
 * WHAT THIS LIST IS FOR, AND WHAT IT IS NOT. Nine of the site's indexable URLs
 * are standalone pages — the four acquisition hubs, the three calculators and
 * the two MetaTrader importers — and every one of them previously reached the
 * footer only through a `#fragment` on some other page, or not at all. A page
 * whose only site-wide link is a header dropdown is one navigation redesign
 * away from being an orphan, and the calculators are the highest-intent entry
 * points on the site.
 *
 * It is deliberately NOT a link farm. Each column stays at five entries or
 * fewer, every anchor is the page's own name rather than a keyword string, and
 * nothing is listed twice. Where an entry had to give way, the `#fragment`
 * links went first: they are anchors into a page already linked above them.
 */
const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Product',
    links: [
      { href: '/products', label: 'All products' },
      { href: '/trading-journal', label: 'Trading journal' },
      { href: '/ai-trading-journal', label: 'AI trading journal' },
      { href: '/free-trading-journal', label: 'Free trading journal' },
      { href: '/products#chart', label: 'Chart & Replay' },
    ],
  },
  {
    heading: 'Platform',
    links: [
      { href: '/brokers', label: 'Supported Brokers' },
      { href: '/integrations/metatrader-5', label: 'MetaTrader 5 import' },
      { href: '/integrations/metatrader-4', label: 'MetaTrader 4 import' },
      { href: '/solutions', label: 'Solutions' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    heading: 'Free tools',
    links: [
      { href: '/tools', label: 'All calculators' },
      { href: '/tools/position-size-calculator', label: 'Position size calculator' },
      { href: '/tools/xauusd-lot-size-calculator', label: 'XAUUSD lot size calculator' },
      { href: '/tools/risk-reward-calculator', label: 'Risk/reward calculator' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { href: '/resources', label: 'Guides' },
      { href: '/resources#help-center', label: 'Help Center' },
      /*
       * /about displaces the `#security` anchor rather than adding a sixth
       * column. It is the entity page — the one that answers "what is this
       * product" — and a fragment into /resources is reachable from the
       * "Guides" link directly above it, so the anchor lost nothing but its
       * duplicate.
       */
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
      { href: '/support', label: 'Support' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { href: '/login', label: 'Log in' },
      { href: '/register', label: 'Get Started' },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-muted/25">
      <div className="mx-auto max-w-[1480px] px-6 py-16 sm:px-10 lg:px-14">
        {/*
         * Seven tracks: the brand block spans two, then one per column in
         * COLUMNS — which keeps the original 2fr-to-1fr proportion now that
         * there are five columns rather than four.
         *
         * NOT `repeat(var(--n), …)`. CSS requires an integer literal as the
         * repeat count, so a custom property there is invalid and the whole
         * declaration is dropped — the grid silently collapses to one column.
         * A span is the version that actually works. `footer.test.tsx` asserts
         * the track count matches the array so the two cannot drift.
         */}
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-7">
          <div className="sm:col-span-2 lg:col-span-2">
            <BrandLockup size={38} />
            <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
              {siteConfig.tagline}
            </p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h2 className="text-sm font-semibold text-foreground">{col.heading}</h2>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </span>
          <span>
            {siteConfig.name} provides analytics and journaling tools — not financial advice.
          </span>
        </div>
      </div>
    </footer>
  );
}
