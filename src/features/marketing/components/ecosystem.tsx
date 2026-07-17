import { Card, CardContent } from '@/components/ui/card';
import { ECOSYSTEM } from '../data';
import { Reveal, Stagger, StaggerItem } from '../motion/reveal';

export function Ecosystem() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:py-28">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            One platform for the whole trading loop
          </h2>
          <p className="mt-3 text-muted-foreground">
            Journal, analyze, review and improve — with a single calculation engine behind every
            screen, so the numbers always reconcile.
          </p>
        </div>
      </Reveal>

      <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ECOSYSTEM.map((item) => (
          <StaggerItem key={item.title}>
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardContent className="p-5">
                <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-medium">{item.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{item.blurb}</p>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
