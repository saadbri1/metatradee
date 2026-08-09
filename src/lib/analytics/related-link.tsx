'use client';

/**
 * A related-content link on a calculator page.
 *
 * WHAT IT REPORTS is the KIND of destination — `signup`, `calculator`,
 * `product` — and the calculator it came from. Enough to answer the only
 * question this dimension exists for: does the tool funnel feed signups, or
 * just more calculators?
 *
 * WHAT IT CANNOT REPORT is anything about the calculation. No inputs, no
 * result, no instrument. The component is not given them, so it could not send
 * them if the call site tried.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { trackEvent } from './analytics';
import type { CalculatorId, RelatedDestination } from './events';

export function RelatedLink({
  calculator,
  destinationType,
  href,
  className,
  children,
}: {
  calculator: CalculatorId;
  destinationType: RelatedDestination;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() =>
        trackEvent('calculator_related_click', {
          calculator,
          destination_type: destinationType,
        })
      }
    >
      {children}
    </Link>
  );
}
