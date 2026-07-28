/**
 * Homepage pricing section.
 *
 * The cards come from `PlanCards` — the same component the public /pricing page
 * uses — so the homepage and the pricing page can never show different numbers.
 * This file is only the section framing, and stays a Server Component; the
 * monthly/yearly toggle is the one client leaf, inside PlanCards.
 */
import Link from 'next/link';
import { PlanCards } from './plan-cards';

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Simple, honest pricing
        </h2>
        <p className="mt-3 text-muted-foreground">
          Start free and keep the journal. Upgrade when it has earned it — and keep everything you
          recorded either way.
        </p>
      </div>

      <PlanCards className="mt-10" />

      <p className="mt-10 text-center text-sm text-muted-foreground">
        <Link
          href="/pricing"
          className="font-medium text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Compare every plan in detail
        </Link>
      </p>
    </section>
  );
}
