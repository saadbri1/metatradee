'use client';

/**
 * A register link that reports the intent.
 *
 * A LINK FIRST, A TRACKER SECOND. It renders a real `next/link` with a real
 * href, so it is crawlable, middle-clickable, keyboard-operable and works with
 * JavaScript disabled. The event is a side effect of the click, never a
 * precondition for the navigation — a blocked beacon must not cost a signup.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { trackEvent } from './analytics';
import type { PageGroup } from './events';

export function SignupCta({
  pageGroup,
  className,
  children,
  href = '/register',
}: {
  pageGroup: PageGroup;
  className?: string;
  children: ReactNode;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackEvent('signup_cta_click', { page_group: pageGroup })}
    >
      {children}
    </Link>
  );
}
