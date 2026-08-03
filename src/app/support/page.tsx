import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero, PageSection, PublicShell } from '@/features/marketing/components/public-shell';
import {
  CONTACT_CHANNELS,
  ContactChannels,
} from '@/features/marketing/components/contact-channels';
import { COMPANY_EMAILS, mailto } from '@/config/contact';
import { MessageForm } from '@/features/contact/components/message-form';
import { submitSupportRequestAction } from '@/features/contact/server/actions';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABEL,
  supportRequestSchema,
} from '@/features/contact/schemas';

export const metadata: Metadata = {
  title: 'Support',
  description:
    'Get help with your MetaTradee account, trade imports, billing and subscriptions, or a technical problem.',
  alternates: { canonical: '/support' },
};

/**
 * Public support page. Support and sales only — a page a frustrated user lands
 * on should not make them choose between four addresses.
 */
const SUPPORT_ONLY = CONTACT_CHANNELS.filter((c) => c.key === 'support' || c.key === 'sales');

/** What to include so the first reply can actually solve the problem. */
const WHAT_TO_INCLUDE = [
  'The email address on your MetaTradee account.',
  'What you expected to happen, and what happened instead.',
  'For an import: the platform (MetaTrader 4 or 5, Interactive Brokers) and the file type.',
  'For a billing question: the date of the payment, not the card number.',
];

export default function SupportPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Support"
        title="Get help with your account"
        lede="Account access, trade imports, billing and subscriptions, or anything technical."
      />

      <PageSection title="Open a support request">
        {/* Every support submission routes to one mailbox server-side; there is
            no recipient field for a client to influence. */}
        <MessageForm
          schema={supportRequestSchema}
          action={submitSupportRequestAction}
          select={{
            name: 'category',
            label: 'What do you need help with?',
            options: SUPPORT_CATEGORIES.map((c) => ({
              value: c,
              label: SUPPORT_CATEGORY_LABEL[c],
            })),
          }}
          fallbackMailbox="support"
          submitLabel="Send support request"
        />
      </PageSection>

      <PageSection title="Or email us directly">
        <ContactChannels channels={SUPPORT_ONLY} />
      </PageSection>

      <PageSection title="What to include" lede="It saves a round trip.">
        <ul className="space-y-2.5">
          {WHAT_TO_INCLUDE.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm leading-6">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        {/*
         * Said explicitly, because a support form is exactly where people
         * paste things they should not.
         */}
        <p className="mt-6 rounded-xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
          Never send your password, broker credentials, API keys or full card number — to us or to
          anyone. MetaTradee support will never ask for them.
        </p>
      </PageSection>

      <PageSection title="Before you write">
        <p className="text-sm leading-6 text-muted-foreground">
          The{' '}
          <Link
            href="/resources"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            guides
          </Link>{' '}
          cover importing, replay, analytics and what each metric means, and the{' '}
          <Link
            href="/pricing"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            pricing page
          </Link>{' '}
          answers most plan questions. If neither helps,{' '}
          <a
            href={mailto('support', 'Support request')}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {COMPANY_EMAILS.support}
          </a>{' '}
          is the fastest route to a person.
        </p>
      </PageSection>
    </PublicShell>
  );
}
