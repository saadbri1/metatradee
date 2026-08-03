import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { BrandLockup } from './brand-mark';
import { mailto } from '@/config/contact';

/**
 * Public footer. Links point at the real public routes the header exposes, so
 * the footer cannot become a graveyard of anchors to sections that moved off
 * the homepage.
 */
const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Product',
    links: [
      { href: '/products', label: 'All products' },
      { href: '/products#journal', label: 'Trading Journal' },
      { href: '/products#analytics', label: 'Trade Analytics' },
      { href: '/products#chart', label: 'Chart & Replay' },
      { href: '/products#ai-coach', label: 'AI Coach' },
    ],
  },
  {
    heading: 'Platform',
    links: [
      { href: '/brokers', label: 'Supported Brokers' },
      { href: '/solutions', label: 'Solutions' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/products#reports', label: 'Reports' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { href: '/resources', label: 'Guides' },
      { href: '/resources#help-center', label: 'Help Center' },
      { href: '/resources#security', label: 'Security & Privacy' },
      { href: mailto('contact'), label: 'Contact' },
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
        <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
          <div>
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
