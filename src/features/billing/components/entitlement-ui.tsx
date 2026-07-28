'use client';

/**
 * Reusable entitlement UI kit.
 *
 * Every piece here is PRESENTATION. Access is decided on the server — page
 * guards and the `assert*` gates in server actions. These components make the
 * boundary legible so a user is never surprised by a dead control, but hiding
 * or disabling something in the browser is never the control itself.
 *
 * Honesty rules baked in:
 *  - The required plan and its price are derived from the plan matrix, so an
 *    upsell can never name a tier that does not actually grant the feature.
 *  - Nothing here counts down, expires, or invents scarcity.
 *  - A locked control keeps its accessible name and stays focusable, so the
 *    reason reaches assistive tech instead of vanishing.
 */
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useEntitlement } from '../hooks';
import { hasFeature } from '../entitlements';
import { minimumTierFor } from '../access';
import { PLANS, type PlanFeatures, type PlanLimits, type PlanTier } from '../plans';
import { formatPrice, priceFor } from '../pricing';

/* -------------------------------------------------------------------------- */
/* Plan identity                                                              */
/* -------------------------------------------------------------------------- */

/** The viewer's current plan. `tier` may be passed when already resolved. */
export function PlanBadge({ tier, className }: { tier?: PlanTier; className?: string }) {
  const { data } = useEntitlement();
  const resolved = tier ?? data?.tier;
  if (!resolved) return null;
  return (
    <Badge variant="secondary" className={className}>
      {PLANS[resolved].name}
    </Badge>
  );
}

/**
 * Inline marker naming the cheapest plan that includes a feature — for sitting
 * beside a control the current plan does not unlock. Renders nothing when no
 * plan grants it, rather than inventing one.
 */
export function RequiresPlan({
  feature,
  className,
}: {
  feature: keyof PlanFeatures;
  className?: string;
}) {
  const tier = minimumTierFor(feature);
  if (!tier) return null;
  return (
    <Badge variant="outline" className={cn('gap-1 font-medium', className)}>
      <Lock className="size-3" aria-hidden />
      {PLANS[tier].name}
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */
/* Gating                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Render `children` only when the resolved entitlement includes `feature`.
 *
 * While the entitlement is still loading this renders NOTHING rather than
 * optimistically showing the gated content — the same fail-closed posture the
 * server takes, so a slow query never flashes paid UI.
 */
export function EntitlementGate({
  feature,
  fallback = null,
  children,
}: {
  feature: keyof PlanFeatures;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { data, isPending } = useEntitlement();
  if (isPending) return null;
  if (!data || !hasFeature(data, feature)) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Section-level locked state. Use in place of a gated panel inside an otherwise
 * available page; a whole gated page uses `FeatureLocked` instead.
 */
export function LockedFeature({
  feature,
  title,
  description,
  className,
}: {
  feature: keyof PlanFeatures;
  title: string;
  description: string;
  className?: string;
}) {
  const tier = minimumTierFor(feature);
  const plan = tier ? PLANS[tier] : null;

  return (
    <section
      aria-labelledby={`locked-${feature}`}
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-6',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Lock className="size-4 text-muted-foreground" aria-hidden />
        <h3 id={`locked-${feature}`} className="text-sm font-semibold">
          {title}
        </h3>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      {plan ? (
        <Button asChild size="sm">
          <Link href="/billing">Upgrade to {plan.name}</Link>
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Not available yet.</p>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Upgrade prompt                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Modal explaining one gated capability. Opened deliberately (a user pressed a
 * locked control) — never on load, on a timer, or on exit intent.
 */
export function UpgradeModal({
  feature,
  title,
  description,
  open,
  onOpenChange,
}: {
  feature: keyof PlanFeatures;
  title: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const tier = minimumTierFor(feature);
  const plan = tier ? PLANS[tier] : null;
  const price = tier ? priceFor(tier) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {plan && price ? (
          <p className="text-sm text-muted-foreground">
            Included from <span className="font-medium text-foreground">{plan.name}</span> —{' '}
            {formatPrice(price.monthly, price.currency)}/month, or{' '}
            {formatPrice(price.annual, price.currency)} billed yearly.
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-start">
          {plan ? (
            <Button asChild>
              <Link href="/billing">See plans</Link>
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A control that is not unlocked. Stays focusable and keeps its name, so the
 * reason is announced rather than silently missing; pressing it explains.
 */
export function LockedAction({
  feature,
  label,
  title,
  description,
  className,
}: {
  feature: keyof PlanFeatures;
  label: ReactNode;
  title: string;
  description: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const tier = minimumTierFor(feature);
  const planName = tier ? PLANS[tier].name : null;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label={planName ? `${title} — requires ${planName}` : title}
        className={cn('gap-1.5 text-muted-foreground', className)}
      >
        <Lock className="size-3.5" aria-hidden />
        {label}
      </Button>
      <UpgradeModal
        feature={feature}
        title={title}
        description={description}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Usage against a numeric limit                                              */
/* -------------------------------------------------------------------------- */

/**
 * Progress toward a plan limit. Renders nothing when the limit is unlimited —
 * an unlimited plan should not be shown a meter at all.
 *
 * The bar is not the only signal: the count is always stated in text, and the
 * at-limit state is announced, so nothing depends on colour alone.
 */
export function UsageLimit({
  limitKey,
  current,
  label,
  className,
}: {
  limitKey: keyof PlanLimits;
  current: number;
  label: string;
  className?: string;
}) {
  const { data } = useEntitlement();
  const limit = data?.limits[limitKey];
  if (limit === null || limit === undefined) return null;

  const pct = Math.min(100, Math.round((current / limit) * 100));
  const atLimit = current >= limit;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {current} of {limit}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${label}: ${current} of ${limit} used`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full', atLimit ? 'bg-destructive' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
      {atLimit ? (
        <p className="text-xs text-muted-foreground">
          You have reached your plan limit.{' '}
          <Link href="/billing" className="font-medium text-foreground underline">
            Compare plans
          </Link>
        </p>
      ) : null}
    </div>
  );
}
