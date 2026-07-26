import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, Check } from 'lucide-react';
import { PageHero, PageSection, PublicShell } from '@/features/marketing/components/public-shell';
import { ADAPTERS } from '@/features/import/adapters';

export const metadata: Metadata = {
  title: 'Supported Brokers',
  description:
    'Platforms MetaTradee can import from today via CSV or JSON statement files, the asset classes they cover, and what is not yet supported.',
  alternates: { canonical: '/brokers' },
};

/**
 * This page is generated from the REAL adapter registry in
 * `@/features/import/adapters`, so it cannot drift from what the importer
 * actually supports, and a platform cannot be advertised that has no adapter.
 *
 * HONESTY: every adapter in the registry declares `liveSync: 'seam'` — meaning
 * statement-file import is implemented and automatic API connection is NOT.
 * The page states that plainly rather than implying live broker connectivity.
 */

/** Asset coverage is a property of the platform, not of our parser. */
const ASSET_CLASSES: Record<string, string> = {
  generic: 'Any — you map the columns',
  mt4: 'Forex, CFDs, metals, indices',
  mt5: 'Forex, CFDs, futures, equities',
  ctrader: 'Forex, CFDs, indices',
  dxtrade: 'Forex, CFDs, futures',
  'match-trader': 'Forex, CFDs, crypto CFDs',
  tradelocker: 'Forex, CFDs, futures',
};

function StatusBadge({ tone, children }: { tone: 'available' | 'planned'; children: string }) {
  return (
    <span
      className={
        tone === 'available'
          ? 'inline-flex items-center gap-1.5 rounded-full bg-profit/10 px-3 py-1 text-[0.8125rem] font-semibold text-profit'
          : 'inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[0.8125rem] font-semibold text-muted-foreground'
      }
    >
      {tone === 'available' ? <Check className="size-3.5" aria-hidden /> : null}
      {children}
    </span>
  );
}

export default function BrokersPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Supported Brokers"
        title="Bring your trade history in from the platform you already use"
        lede="MetaTradee imports statement files you export from your platform. Every row is validated and de-duplicated before it reaches your journal."
      />

      <PageSection>
        {/* The single most important disclosure on this page. */}
        <div className="flex gap-4 rounded-2xl border border-warning/30 bg-warning/5 p-6">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="text-base font-semibold text-foreground">
              File import today — no automatic broker connection yet
            </p>
            <p className="mt-2 max-w-3xl text-[0.9375rem] leading-7 text-muted-foreground">
              MetaTradee does not connect to your broker account, and it never asks for your trading
              credentials. You export a statement from your platform and upload it. Live API
              synchronisation is designed for but not built, and it is listed as{' '}
              <span className="font-medium text-foreground">not yet supported</span> below rather
              than advertised as available.
            </p>
          </div>
        </div>
      </PageSection>

      <PageSection
        title="Platforms with a dedicated importer"
        lede="Each of these has an adapter that recognises that platform's column names automatically. Anything not listed still imports through the generic mapper."
      >
        <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
          <table className="w-full min-w-[900px] border-collapse text-left text-[0.9375rem]">
            <caption className="sr-only">
              Platforms MetaTradee can import from, with connection method and availability
            </caption>
            <thead className="border-b border-border/70 bg-muted/50 text-[0.8125rem] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-6 py-4 font-semibold">
                  Platform
                </th>
                <th scope="col" className="px-6 py-4 font-semibold">
                  Connection method
                </th>
                <th scope="col" className="px-6 py-4 font-semibold">
                  Import type
                </th>
                <th scope="col" className="px-6 py-4 font-semibold">
                  Asset classes
                </th>
                <th scope="col" className="px-6 py-4 font-semibold">
                  Availability
                </th>
              </tr>
            </thead>
            <tbody>
              {ADAPTERS.map((adapter) => (
                <tr key={adapter.id} className="border-b border-border/50 last:border-0">
                  <th scope="row" className="px-6 py-4 font-semibold text-foreground">
                    {adapter.label}
                  </th>
                  <td className="px-6 py-4 text-muted-foreground">Statement file upload</td>
                  <td className="px-6 py-4 uppercase text-muted-foreground">
                    {adapter.formats.join(' · ')}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {ASSET_CLASSES[adapter.id] ?? 'Varies by account'}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge tone="available">Available</StatusBadge>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-border bg-muted/25">
                <th scope="row" className="px-6 py-4 font-semibold text-foreground">
                  Automatic broker sync (any platform)
                </th>
                <td className="px-6 py-4 text-muted-foreground">Broker API</td>
                <td className="px-6 py-4 text-muted-foreground">—</td>
                <td className="px-6 py-4 text-muted-foreground">—</td>
                <td className="px-6 py-4">
                  <StatusBadge tone="planned">Not yet supported</StatusBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-[0.9375rem] leading-7 text-muted-foreground">
          Using a platform that is not listed? The generic importer maps any CSV or JSON export —
          you match your columns once and MetaTradee remembers the mapping.{' '}
          <Link
            href="/resources#contact"
            className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Tell us which platform you use
          </Link>{' '}
          and we will prioritise an adapter for it.
        </p>
      </PageSection>

      <PageSection title="What happens to an imported file">
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Parse', 'Your CSV or JSON is read and its columns detected.'],
            ['Map', 'Columns are matched to trade fields — you confirm before anything is saved.'],
            [
              'Validate',
              'Rows that cannot produce a valid trade are reported, not silently dropped.',
            ],
            ['De-duplicate', 'A content hash stops the same trade being imported twice.'],
          ].map(([title, body], index) => (
            <li key={title} className="rounded-2xl border border-border/70 bg-card p-6">
              <span className="text-[0.8125rem] font-semibold text-primary">Step {index + 1}</span>
              <p className="mt-2 text-lg font-semibold text-foreground">{title}</p>
              <p className="mt-2 text-[0.9375rem] leading-6 text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </PageSection>
    </PublicShell>
  );
}
