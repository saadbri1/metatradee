import { Building2, CreditCard, LifeBuoy, Mail } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { COMPANY_EMAILS, mailto, type PublicEmailKey } from '@/config/contact';
import { ContactChannelLink } from '@/lib/analytics/contact-channel-link';

/**
 * The public contact routes, rendered from the central config.
 *
 * ROUTING IS THE POINT, not decoration. Five mailboxes exist so that a billing
 * dispute does not land in a general inbox and a sales lead does not land in
 * support. Each card therefore says what the address is FOR, in the words a
 * visitor would use, rather than just printing the address — the common failure
 * mode of a contact page is four identical-looking links that all get used
 * interchangeably.
 *
 * `admin@` is absent by construction: it is not a member of COMPANY_EMAILS, so
 * a component that renders "every public address" cannot reach it.
 */

export interface ContactChannel {
  key: PublicEmailKey;
  icon: LucideIcon;
  title: string;
  description: string;
  /** Prefilled subject, so the mail arrives already triaged. */
  subject: string;
}

export const CONTACT_CHANNELS: ContactChannel[] = [
  {
    key: 'support',
    icon: LifeBuoy,
    title: 'Customer support',
    description:
      'Account help, login problems, trade imports that will not go through, and anything technical. Also the right address for billing and subscription questions.',
    subject: 'Support request',
  },
  {
    key: 'sales',
    icon: CreditCard,
    title: 'Sales and pricing',
    description:
      'Questions about plans, upgrades, team access, or buying for more than one trader.',
    subject: 'Sales enquiry',
  },
  {
    key: 'contact',
    icon: Mail,
    title: 'General enquiries',
    description: 'Anything that does not fit the others. We read every message.',
    subject: 'General enquiry',
  },
  {
    key: 'info',
    icon: Building2,
    title: 'Company, press and partnerships',
    description: 'Company information, media requests, and partnership or integration proposals.',
    subject: 'Company enquiry',
  },
];

export function ContactChannels({ channels = CONTACT_CHANNELS }: { channels?: ContactChannel[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {channels.map((c) => (
        <li
          key={c.key}
          className="rounded-2xl border border-border/70 bg-card p-6 transition-colors hover:border-primary/40 motion-reduce:transition-none"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <c.icon className="size-5" aria-hidden />
          </span>
          <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">{c.title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{c.description}</p>
          <ContactChannelLink
            channel={c.key}
            href={mailto(c.key, c.subject)}
            className="mt-4 inline-flex min-h-11 items-center break-all text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {COMPANY_EMAILS[c.key]}
          </ContactChannelLink>
        </li>
      ))}
    </ul>
  );
}
