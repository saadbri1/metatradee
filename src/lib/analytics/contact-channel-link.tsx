'use client';

/**
 * A public mailbox link that reports the click.
 *
 * A REAL `mailto:` ANCHOR FIRST. The href is built by `mailto()` from the
 * central contact config exactly as before; this only adds a click listener, so
 * the link still works with JavaScript off and still opens the user's mail
 * client if the beacon is blocked.
 *
 * THE ADDRESS IS NEVER SENT — only the channel KEY (`support`, `sales`, …).
 * `PublicEmailKey` is derived from `COMPANY_EMAILS`, and the admin mailbox is
 * deliberately exported separately from it, so `admin@` cannot be instrumented
 * here even by mistake.
 */
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { PublicEmailKey } from '@/config/contact';
import { pageGroupFor } from './page-group';
import { trackEvent } from './analytics';

export function ContactChannelLink({
  channel,
  href,
  className,
  children,
}: {
  channel: PublicEmailKey;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <a
      href={href}
      className={className}
      onClick={() =>
        trackEvent('contact_channel_click', {
          channel,
          source_page: pageGroupFor(pathname),
        })
      }
    >
      {children}
    </a>
  );
}
