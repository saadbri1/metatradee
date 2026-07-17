import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';
import { Reveal } from '../motion/reveal';

export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24">
      <Reveal y={24}>
        <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/30 px-6 py-14 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-0 h-72 w-[640px] -translate-x-1/2 rounded-full bg-primary/10 blur-[100px]" />
          </div>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {siteConfig.tagline}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Turn your trading history into a measurable edge — with analytics you can trust and a
            coach that only ever cites your own data.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">
                Create your free account <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
