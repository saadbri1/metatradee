import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { Wordmark } from './wordmark';

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Product',
    links: [
      { href: '#features', label: 'Features' },
      { href: '#journal', label: 'Journal' },
      { href: '#analytics', label: 'Analytics' },
      { href: '#ai-coach', label: 'AI Coach' },
    ],
  },
  {
    heading: 'Platform',
    links: [
      { href: '#import', label: 'Broker import' },
      { href: '#workspace', label: 'Workspaces' },
      { href: '#reports', label: 'Reports' },
      { href: '#pricing', label: 'Pricing' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { href: '/login', label: 'Log in' },
      { href: '/register', label: 'Sign up' },
      { href: '#faq', label: 'FAQ' },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">{siteConfig.tagline}</p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h2 className="text-sm font-medium">{col.heading}</h2>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </span>
          <span>MetaTradee provides analytics and journaling tools — not financial advice.</span>
        </div>
      </div>
    </footer>
  );
}
