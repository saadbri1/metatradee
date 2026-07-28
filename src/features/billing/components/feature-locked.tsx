/**
 * Full-page locked state, rendered by a Server Component in place of a gated
 * page's content. The premium tree is never sent to the browser.
 *
 * Deliberately not a redirect: the user keeps their place in the app, sees
 * exactly which capability is gated and which plan includes it, and gets one
 * clear way forward. It states what IS still available on the current plan so
 * the page is not a dead end. No countdown, no fake scarcity, no dark pattern.
 */
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PLANS, type PlanFeatures, type PlanTier } from '../plans';
import { minimumTierFor } from '../access';
import { priceFor, formatPrice } from '../pricing';

export function FeatureLocked({
  title,
  description,
  feature,
  currentTier,
}: {
  title: string;
  description: string;
  feature: keyof PlanFeatures;
  currentTier: PlanTier;
}) {
  const requiredTier = minimumTierFor(feature);
  const requiredPlan = requiredTier ? PLANS[requiredTier] : null;
  const price = requiredTier ? priceFor(requiredTier) : null;

  return (
    <section
      aria-labelledby="feature-locked-title"
      className="mx-auto flex w-full max-w-xl flex-col items-start gap-5 rounded-lg border border-border bg-card p-8"
    >
      <span className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Lock className="size-5" aria-hidden />
      </span>

      <div className="space-y-2">
        <h1
          id="feature-locked-title"
          className="font-display text-2xl font-semibold tracking-tight"
        >
          {title}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">Your plan: {PLANS[currentTier].name}</Badge>
        {requiredPlan && price ? (
          <Badge variant="outline">
            Included from {requiredPlan.name} — {formatPrice(price.monthly, price.currency)}/mo
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/billing">
            {requiredPlan ? `Upgrade to ${requiredPlan.name}` : 'View plans'}
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </section>
  );
}
