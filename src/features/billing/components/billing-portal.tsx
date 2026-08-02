'use client';

/**
 * Self-serve billing: what you are on, what you are using, what else exists,
 * and what you have been charged.
 *
 * No dark patterns. Cancelling is one link to the provider-hosted portal, not
 * a retention maze, and the page states plainly that access continues to the
 * end of the paid period and that nothing is deleted on downgrade — which is
 * what the code actually does, since limits block new additions only.
 *
 * Card data is never handled here; the provider hosts checkout and the portal.
 */
import { useCallback } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormSkeleton } from '@/features/workspace/components/states';
import { PLANS } from '../plans';
import { formatPrice, priceFor, isFree } from '../pricing';
import { useBillingOverview, useOpenPortal } from '../hooks';
import { PlansTable } from './plans-table';
import { UsageLimit } from './entitlement-ui';

function money(cents: number, currency: string): string {
  return formatPrice(cents, currency);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function BillingPortal() {
  const overview = useBillingOverview();

  /*
   * Stable identity, and that is load-bearing rather than tidiness. An inline
   * arrow here is a new function on every render of this page, and that
   * identity used to reach the PayPal button's effect dependencies and mount a
   * SECOND button on top of the first. The button now holds the callback in a
   * ref so it is safe either way, but a stable reference is the correct thing
   * to hand across that boundary regardless.
   */
  const handlePaid = useCallback(() => {
    void overview.refetch();
  }, [overview]);
  const portal = useOpenPortal();

  if (overview.isLoading) return <FormSkeleton rows={6} />;

  const data = overview.data;
  const ent = data?.entitlement;
  const tier = ent?.tier ?? 'free';
  const plan = PLANS[tier];
  const price = priceFor(tier);
  const usage = data?.usage;
  // One-time access always has an end date; the badge states it rather than
  // implying the plan continues.
  const accessEnds = ent?.endingAt ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your plan, what you are using, and your payments. Access is bought a period at a time and
          never renews automatically, so there is nothing to cancel. When a period ends your account
          returns to Free with everything you have recorded still intact.
        </p>
      </div>

      {data?.mock ? (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <strong className="font-medium text-foreground">Paid plans are not on sale yet.</strong>{' '}
          No payment provider is connected, so checkout and the billing portal are unavailable and
          no card can be charged. Your current plan and limits below are real and enforced.
        </p>
      ) : null}

      {/* Payment needs attention. Stated once, plainly, not as a nag banner. */}
      {ent?.inGracePeriod ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="text-sm">
            <p className="font-medium">Your last payment did not go through.</p>
            <p className="mt-1 text-muted-foreground">
              You still have full access while the payment is retried. Updating your payment method
              in the billing portal resolves it.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        {/* Current plan. */}
        <Card role="region" aria-label="Current plan summary">
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <CardTitle className="text-base">Current plan</CardTitle>
            {accessEnds ? (
              <Badge variant="outline">Access ends {formatDate(accessEnds)}</Badge>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-display text-2xl font-semibold">{plan.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isFree(tier)
                  ? 'Free — nothing to pay and no payment method on file.'
                  : `${formatPrice(price.monthly)} for 30 days, or ${formatPrice(price.annual)} for 365 days.`}
              </p>
            </div>

            {accessEnds ? (
              <p className="text-sm text-muted-foreground">
                Your access runs until {formatDate(accessEnds)}. Nothing renews and nothing will be
                charged again — after that date your account moves to Free with all of your data
                intact. Paying again before then adds the new days on top of what you have left.
              </p>
            ) : null}

            {data?.provider === 'paypal' ? (
              /*
               * NOTHING TO CANCEL. This used to link to PayPal's autopay page,
               * which is where recurring billing agreements live — there is no
               * longer any agreement to hold, so that link would send the user
               * to an empty page looking for a subscription that does not
               * exist. Saying so plainly is the honest control.
               */
              <p className="text-sm text-muted-foreground">
                Payments are taken one at a time through PayPal. There is no stored payment method
                and no recurring agreement, so there is nothing to cancel or manage.
              </p>
            ) : (
              <Button
                variant="outline"
                onClick={() => portal.mutate()}
                disabled={portal.isPending || (data?.mock ?? true)}
              >
                <ExternalLink aria-hidden />{' '}
                {data?.mock ? 'Billing portal unavailable' : 'Manage billing & payment method'}
              </Button>
            )}
            {portal.data && !portal.data.ok ? (
              <p className="text-sm text-muted-foreground" role="status">
                {portal.data.error}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* Usage against the plan's real limits. */}
        <Card role="region" aria-label="Your usage">
          <CardHeader>
            <CardTitle className="text-base">Your usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {usage ? (
              <>
                <UsageLimit limitKey="maxTrades" current={usage.trades} label="Trades" />
                <UsageLimit
                  limitKey="maxAccounts"
                  current={usage.accounts}
                  label="Trading accounts"
                />
                <UsageLimit limitKey="maxStrategies" current={usage.playbooks} label="Playbooks" />
                {plan.limits.maxTrades === null &&
                plan.limits.maxAccounts === null &&
                plan.limits.maxStrategies === null ? (
                  <p className="text-sm text-muted-foreground">
                    Your plan has no limits on trades, accounts or playbooks.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Usage is unavailable right now.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plans. */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">Plans</h2>
        {/*
         * Refetch on a SERVER-VERIFIED capture, so the plan and expiry above
         * come from the database rather than from what the button believed.
         */}
        <PlansTable
          currentTier={ent?.tier}
          checkoutUnavailable={data?.mock ?? true}
          onPaid={handlePaid}
        />
      </section>

      {/* Invoices. */}
      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold tracking-tight">Invoices</h2>
        {data && data.invoices.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Your billing invoices</caption>
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
                    <td className="px-3 py-2">{formatDate(inv.createdAt)}</td>
                    <td className="px-3 py-2">{inv.status}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
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
                          <span className="sr-only">
                            Invoice from {formatDate(inv.createdAt)} —{' '}
                          </span>
                          Download
                        </a>
                      ) : (
                        <span aria-label="No PDF available">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No invoices yet. They appear here after your first payment.
          </p>
        )}
      </section>
    </div>
  );
}
