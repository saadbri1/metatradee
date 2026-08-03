import type { Metadata } from 'next';
import { PageHero, PageSection, PublicShell } from '@/features/marketing/components/public-shell';
import { ContactChannels } from '@/features/marketing/components/contact-channels';
import { COMPANY_EMAILS, mailto } from '@/config/contact';
import { MessageForm } from '@/features/contact/components/message-form';
import { submitContactRequestAction } from '@/features/contact/server/actions';
import {
  INQUIRY_TYPES,
  INQUIRY_TYPE_LABEL,
  contactRequestSchema,
} from '@/features/contact/schemas';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: `How to reach ${siteConfig.name}: support, sales, general enquiries, and company or press information.`,
  alternates: { canonical: '/contact' },
};

/**
 * Public contact page.
 *
 * Every address comes from the central config, so this page cannot drift from
 * the footer or the structured data. The administrative mailbox is not
 * reachable from here — it is not part of COMPANY_EMAILS.
 */
export default function ContactPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Contact"
        title="Talk to a person"
        lede="Pick the address that matches what you need — it reaches the right people faster than a general inbox."
      />

      <PageSection title="Send a message">
        <MessageForm
          schema={contactRequestSchema}
          action={submitContactRequestAction}
          select={{
            name: 'inquiryType',
            label: 'What is this about?',
            /*
             * The client sends this KEY only. The mailbox it maps to is
             * resolved server-side in send-contact-request.ts, so a tampered
             * form cannot choose a recipient.
             */
            options: INQUIRY_TYPES.map((t) => ({ value: t, label: INQUIRY_TYPE_LABEL[t] })),
          }}
          fallbackMailbox="contact"
        />
      </PageSection>

      <PageSection title="Or email us directly">
        <ContactChannels />
        <p className="mt-8 text-sm text-muted-foreground">
          Already have an account? Support requests sent from{' '}
          <a
            href={mailto('support', 'Support request')}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {COMPANY_EMAILS.support}
          </a>{' '}
          are answered faster when they include the email address on the account and, if it is an
          import problem, the platform and file type you are importing.
        </p>
      </PageSection>
    </PublicShell>
  );
}
