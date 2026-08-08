import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { absoluteUrl, breadcrumbsFor, type SeoPath } from '@/config/seo';
import { serializeJsonLd } from '../seo';

/**
 * Public breadcrumb trail — visible navigation AND the `BreadcrumbList` that
 * describes it.
 *
 * ONE SOURCE FOR BOTH. The markup and the JSON-LD are generated from the same
 * `breadcrumbsFor()` call, so the structured data cannot describe a trail the
 * page does not show. Structured data that disagrees with the visible page is
 * a manual-action risk, and it is usually caused by exactly this: two hand-kept
 * copies of the same list.
 *
 * The current page IS included in the trail — Google's guidance expects the
 * full path — but it is rendered as plain text with `aria-current`, not as a
 * link to itself.
 */
export function Breadcrumbs({ path }: { path: SeoPath }) {
  const trail = breadcrumbsFor(path);
  // A single crumb is just the home page; a trail of one is visual noise.
  if (trail.length < 2) return null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-1.5">
              {index > 0 ? (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
              ) : null}
              {isLast ? (
                <span aria-current="page" className="font-medium text-foreground">
                  {crumb.name}
                </span>
              ) : (
                <Link
                  href={crumb.path}
                  className="rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {crumb.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
