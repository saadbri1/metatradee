import type { ReactNode } from 'react';
import Link from 'next/link';

/** Settings shell: heading + section nav. Active styling is handled per-page. */
const SECTIONS = [
  { href: '/settings/profile', label: 'Profile' },
  { href: '/settings/trading', label: 'Trading' },
  { href: '/settings/preferences', label: 'Preferences' },
  { href: '/settings/security', label: 'Security' },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile, trading profile, and preferences.
        </p>
      </header>
      <nav aria-label="Settings sections" className="flex gap-1 border-b border-border">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-t-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {s.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
