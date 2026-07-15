/**
 * KPI summary cards. Server-rendered. Values come pre-formatted from
 * `buildKpiCards` (engine-derived). Profit/loss tone uses ONLY the reserved
 * --profit/--loss tokens; every value is screen-reader labelled.
 */
import { Card, CardContent } from '@/components/ui/card';
import type { KpiCard } from '../kpi';

const toneClass: Record<-1 | 0 | 1, string> = {
  1: 'text-profit',
  [-1]: 'text-loss',
  0: '',
};

export function KpiCards({ cards }: { cards: KpiCard[] }) {
  return (
    <section aria-label="Key performance indicators">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <li key={c.id}>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className={`tabular mt-1 text-2xl font-semibold ${toneClass[c.tone]}`}>
                  <span aria-hidden>{c.value}</span>
                  <span className="sr-only">{c.srLabel}</span>
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
