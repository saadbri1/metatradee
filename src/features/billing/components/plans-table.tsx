'use client';

/**
 * In-app plan comparison and ONE-TIME checkout.
 *
 * Prices come from the central pricing config — the same values the public
 * pricing page shows, so a user cannot be quoted one price on the marketing
 * site and another after signing in. PayPal remains authoritative for what is
 * actually charged, and the server re-derives the amount from this same config
 * before the order is created.
 *
 * NOTHING HERE RENEWS. Every payment buys a fixed number of days — 30 or 365 —
 * and then stops. The copy says so at every decision point rather than once in
 * small print, because "no automatic renewal" is the single most surprising
 * thing about this checkout for anyone used to a subscription.
 *
 * There is deliberately no trial wording anywhere: a trial implies something
 * that later starts charging, and nothing here ever charges twice.
 */
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PLANS, PAID_TIERS, type PlanFeatures, type PlanTier } from '../plans';
import { getPayPalOrdersConfigAction } from '../server/paypal-config-action';
import { PayPalPayButton } from './paypal-pay-button';
import { DAYS_FOR_INTERVAL } from '../access-period';
import {
  ANNUAL_LABEL,
  RECOMMENDED_TIER,
  TIER_ORDER,
  amountFor,
  annualSavingPercent,
  formatPrice,
  isFree,
  monthlyEquivalent,
  type BillingInterval,
} from '../pricing';

const FEATURE_LABELS: Record<keyof PlanFeatures, string> = {
  advancedAnalytics: 'Advanced analytics',
  brokerImport: 'Broker import',
  playbookAdvanced: 'Playbook versioning & adherence',
  tradeReplay: 'Bar-by-bar trade replay',
  aiCoach: 'AI Coach',
  reportsExport: 'Report export',
  reportSharing: 'Shareable report links',
  propFirmTools: 'Prop-firm tools',
};

export function PlansTable({
  currentTier,
  checkoutUnavailable = false,
  onPaid,
}: {
  currentTier?: PlanTier;
  /** Fires on a SERVER-VERIFIED completed capture, never on button success. */
  onPaid?: () => void;
  /**
   * PayPal is not configured. Checkout would go nowhere, so the control is
   * disabled and says so rather than pretending to start a purchase.
   */
  checkoutUnavailable?: boolean;
}) {
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const annual = interval === 'annual';
  const days = DAYS_FOR_INTERVAL[interval];
  const [paypal, setPaypal] = useState<{
    available: boolean;
    clientId: string | null;
    environment: 'sandbox' | 'live';
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPayPalOrdersConfigAction().then((cfg) => {
      if (!cancelled) setPaypal(cfg);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * No user id is fetched or held here, unlike the retired subscription flow.
   * The Orders path binds the payment to the caller SERVER-SIDE at creation,
   * so the browser never handles an owner identifier at all.
   */
  const paypalReady = !checkoutUnavailable && !!paypal?.available && !!paypal.clientId;

  /**
   * One place decides what a paid tier's call-to-action is, so the disabled and
   * live paths cannot drift.
   *
   * There is no "cancel your current plan first" branch any more: one-time
   * payments do not conflict. Paying again while access is still live STACKS —
   * the new days are added to the existing expiry rather than replacing it —
   * so a second purchase costs the buyer nothing they already hold.
   */
  function renderCta(tier: PlanTier) {
    if (!paypalReady || !paypal?.clientId) {
      return (
        <Button className="w-full" disabled>
          Not available yet
        </Button>
      );
    }
    return (
      <PayPalPayButton clientId={paypal.clientId} tier={tier} interval={interval} onPaid={onPaid} />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {/* Access length, not a billing cycle — there is no cycle. */}
        <div className="flex items-center gap-2" role="group" aria-label="Length of access">
          <Button
            size="sm"
            variant={annual ? 'outline' : 'default'}
            aria-pressed={!annual}
            onClick={() => setInterval('monthly')}
          >
            30 days access
          </Button>
          <Button
            size="sm"
            variant={annual ? 'default' : 'outline'}
            aria-pressed={annual}
            onClick={() => setInterval('annual')}
          >
            365 days access
          </Button>
        </div>
        <p className="text-sm font-medium text-primary">{ANNUAL_LABEL}</p>
      </div>

      <p className="text-sm text-muted-foreground">
        Each payment buys a fixed period of access and then stops.{' '}
        <span className="font-medium text-foreground">There is no automatic renewal</span> — nothing
        is stored and nothing is charged again. Paying again while your access is still live adds
        the new days on top of what you already have.
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TIER_ORDER.map((tier) => {
          const plan = PLANS[tier];
          const free = isFree(tier);
          const isCurrent = currentTier === tier;
          const enabled = (Object.keys(plan.features) as (keyof PlanFeatures)[]).filter(
            (key) => plan.features[key],
          );
          return (
            <Card
              key={tier}
              aria-label={`${plan.name} plan`}
              className={isCurrent ? 'border-primary' : ''}
            >
              <CardHeader className="space-y-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  {plan.name}
                  {isCurrent ? <Badge>Current</Badge> : null}
                  {!isCurrent && tier === RECOMMENDED_TIER ? (
                    <Badge variant="outline">Recommended</Badge>
                  ) : null}
                </CardTitle>
                {/*
                 * The headline is the amount ACTUALLY charged, once, for the
                 * selected period — not a derived per-month figure. A "/mo"
                 * price on a payment that never repeats is the kind of number
                 * that reads as a subscription.
                 */}
                <p className="text-2xl font-semibold tabular-nums">
                  {free ? 'Free' : formatPrice(amountFor(tier, interval))}
                  {!free ? (
                    <span className="ml-1 text-sm font-normal text-muted-foreground">once</span>
                  ) : null}
                </p>
                <p className="min-h-[1rem] text-xs text-muted-foreground">
                  {free
                    ? 'No payment required'
                    : annual
                      ? `${days} days access — works out at ${formatPrice(monthlyEquivalent(tier))} a month, ${annualSavingPercent(tier)}% less than paying 30 days at a time`
                      : `${days} days access`}
                </p>
              </CardHeader>

              <CardContent className="space-y-3">
                <ul className="space-y-1.5 text-sm">
                  <li className="text-muted-foreground">
                    {plan.limits.maxTrades === null
                      ? 'Unlimited trades'
                      : `${plan.limits.maxTrades.toLocaleString('en-US')} trades`}
                  </li>
                  {enabled.map((key) => (
                    <li key={key} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <span>{FEATURE_LABELS[key]}</span>
                    </li>
                  ))}
                </ul>

                {PAID_TIERS.includes(tier) ? renderCta(tier) : null}

                {!free ? (
                  <p className="text-center text-xs text-muted-foreground">
                    {formatPrice(amountFor(tier, interval))} once, for {days} days. No automatic
                    renewal.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {paypal?.available && paypal.environment === 'sandbox' ? (
        <p className="text-xs text-muted-foreground">
          PayPal <span className="font-medium text-foreground">Sandbox</span> — payments here are
          simulated and no real money moves.
        </p>
      ) : null}
    </div>
  );
}
