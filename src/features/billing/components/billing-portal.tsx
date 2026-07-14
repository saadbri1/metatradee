'use client';

/**
 * Self-serve billing portal: current plan + status, invoices, and manage/cancel
 * via the PROVIDER-hosted portal (honest, self-serve — no dark patterns). Cancel
 * messaging states access continues to period end. Card updates happen on the
 * provider only.
 */
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormSkeleton } from '@/features/workspace/components/states';
import { PLANS } from '../plans';
import { useBillingOverview, useOpenPortal } from '../hooks';
import { PlansTable } from './plans-table';

function money(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  });
}

export function BillingPortal() {
  const overview = useBillingOverview();
  const portal = useOpenPortal();

  if (overview.isLoading) return <FormSkeleton rows={6} />;
  const data = overview.data;
  const ent = data?.entitlement;
  const plan = ent ? PLANS[ent.tier] : PLANS.free;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your plan, payment method, and invoices. Cancel anytime — access continues to the
          end of your paid period.
        </p>
      </div>

      {data?.mock ? (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Billing is in demo mode (no live payment provider configured). Checkout and portal links
          are placeholders.
        </p>
      ) : null}

      {/* Current plan + status. */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Current plan</CardTitle>
          {ent?.inGracePeriod ? (
            <Badge variant="outline">Payment past due — update to keep access</Badge>
          ) : ent?.endingAt ? (
            <Badge variant="secondary">Ends {new Date(ent.endingAt).toLocaleDateString()}</Badge>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-2xl font-semibold">{plan.name}</p>
          <p className="text-sm text-muted-foreground">
            {plan.limits.maxTrades === null
              ? 'Unlimited trades'
              : `Up to ${plan.limits.maxTrades} trades`}
            {ent?.status && ent.status !== 'none' ? ` · ${ent.status}` : ''}
          </p>
          <Button variant="outline" onClick={() => portal.mutate()} disabled={portal.isPending}>
            <ExternalLink aria-hidden /> Manage billing &amp; payment method
          </Button>
          {portal.data && !portal.data.ok ? (
            <p className="text-sm text-muted-foreground" role="status">
              {portal.data.error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Invoices. */}
      {data && data.invoices.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold tracking-tight">Invoices</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Billing invoices</caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-3 py-2">
                    Date
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Amount
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    PDF
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((inv) => (
                  <tr key={inv.providerInvoiceId} className="border-t border-border">
                    <td className="px-3 py-2">{new Date(inv.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{inv.status}</td>
                    <td className="tabular px-3 py-2 text-right">
                      {money(inv.amountPaid || inv.amountDue, inv.currency)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {inv.pdfUrl ? (
                        <a
                          href={inv.pdfUrl}
                          className="text-primary underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Plans. */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">Plans</h2>
        <PlansTable currentTier={ent?.tier} />
      </section>
    </div>
  );
}
