'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

function titleCase(segment: string): string {
  return segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Breadcrumbs — shown only at depth ≥ 3 (L3), omitted at L1/L2 per the nav IA.
 * The workspace title in the top bar covers L1/L2.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 3) return null;

  return (
    <nav aria-label="Breadcrumb" className="hidden md:block">
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        {segments.map((seg, i) => {
          const href = `/${segments.slice(0, i + 1).join('/')}`;
          const isLast = i === segments.length - 1;
          return (
            <Fragment key={href}>
              {i > 0 ? <ChevronRight className="size-3.5 shrink-0" aria-hidden /> : null}
              {isLast ? (
                <span aria-current="page" className="text-foreground">
                  {titleCase(seg)}
                </span>
              ) : (
                <Link href={href} className="hover:text-foreground">
                  {titleCase(seg)}
                </Link>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
