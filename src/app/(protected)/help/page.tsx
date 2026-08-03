import type { Metadata } from 'next';
import Link from 'next/link';
import { CreditCard, ExternalLink, LifeBuoy, Upload } from 'lucide-react';
import { Panel, PanelBody, PanelHeader, PanelTitle } from '@/components/ui/panel';
import { COMPANY_EMAILS, mailto } from '@/config/contact';

export const metadata: Metadata = { title: 'Help' };

/**
 * In-app help. Replaces the placeholder, which said "Coming soon" to a signed-in
 * user who needed an answer.
 *
 * Every route here goes to a mailbox that is actually monitored for that topic:
 * account and technical to support, billing to support (not sales — a person
 * with a charge problem is not a lead), plan and upgrade questions to sales.
 */
const TOPICS = [
  {
    icon: Upload,
    title: 'Trade imports',
    body: 'An import that fails, stalls, or brings in the wrong figures. Tell us the platform and the file type.',
    subject: 'Import problem',
    key: 'support' as const,
  },
  {
    icon: CreditCard,
    title: 'Billing and subscription',
    body: 'A payment you do not recognise, access that did not start, or a question about what you were charged.',
    subject: 'Billing question',
    key: 'support' as const,
  },
  {
    icon: LifeBuoy,
    title: 'Account and technical',
    body: 'Sign-in trouble, something broken, or data that does not look right.',
    subject: 'Account or technical issue',
    key: 'support' as const,
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-stack">
      <div>
        <h1 className="font-display text-page-title font-semibold tracking-tight">Help</h1>
        <p className="mt-1 text-control text-muted-foreground">
          Guides, and a direct route to a person when you need one.
        </p>
      </div>

      <div className="grid gap-stack md:grid-cols-3">
        {TOPICS.map((t) => (
          <Panel as="section" key={t.title}>
            <PanelHeader>
              <t.icon className="size-4 shrink-0 text-primary" aria-hidden />
              <PanelTitle as="h2">{t.title}</PanelTitle>
            </PanelHeader>
            <PanelBody className="flex flex-col gap-3">
              <p className="text-meta leading-5 text-muted-foreground">{t.body}</p>
              <a
                href={mailto(t.key, t.subject)}
                className="mt-auto inline-flex min-h-11 items-center gap-1.5 text-control font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {COMPANY_EMAILS[t.key]}
              </a>
            </PanelBody>
          </Panel>
        ))}
      </div>

      <Panel as="section">
        <PanelHeader>
          <PanelTitle as="h2">Guides and plans</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-2 text-control text-muted-foreground">
          <p>
            The{' '}
            <Link
              href="/resources"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              guides
            </Link>{' '}
            cover importing, replay, analytics and what each metric means.
          </p>
          <p>
            Questions about plans, upgrades or team access go to{' '}
            <a
              href={mailto('sales', 'Plan enquiry')}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {COMPANY_EMAILS.sales}
            </a>
            .
          </p>
          <p className="flex items-center gap-1.5 pt-1">
            <ExternalLink className="size-3.5 shrink-0" aria-hidden />
            <Link
              href="/support"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Public support page
            </Link>
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
