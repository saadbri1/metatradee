'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DailyPnlPoint } from '../types';
import { DashboardInfoTip } from './dashboard-info-tip';
import { CumulativePnlChart, DailyPnlBarChart } from './pnl-charts';

export function PnlWorkspaceCard({ points }: { points: DailyPnlPoint[] }) {
  const [view, setView] = useState<'cumulative' | 'daily'>('cumulative');
  return (
    <section
      className="motion-content-enter min-h-[472px] overflow-hidden rounded-md border border-border/70 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.025)]"
      aria-label="Profit and loss chart"
      data-dashboard-card="pnl-workspace"
    >
      <Tabs value={view} onValueChange={(value) => setView(value as 'cumulative' | 'daily')}>
        <header className="flex h-[54px] items-center border-b border-border/70 px-4">
          <TabsList className="h-full gap-5 bg-transparent p-0">
            <TabsTrigger
              value="cumulative"
              className="h-full rounded-none border-b-2 border-transparent px-1 text-[13px] font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Daily Net Cumulative P&amp;L
            </TabsTrigger>
            <TabsTrigger
              value="daily"
              className="h-full rounded-none border-b-2 border-transparent px-1 text-[13px] font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Net Daily P&amp;L
            </TabsTrigger>
          </TabsList>
          <div className="ml-auto">
            <DashboardInfoTip label="About profit and loss charts">
              Switch between chronological cumulative realized P&amp;L and realized net P&amp;L
              grouped by closing day. Both views use the same shared Dashboard filters and workspace
              timezone.
            </DashboardInfoTip>
          </div>
        </header>
        <TabsContent value="cumulative" className="motion-content-enter m-0 p-4">
          <CumulativePnlChart points={points} heightClassName="h-[386px]" />
        </TabsContent>
        <TabsContent value="daily" className="motion-content-enter m-0 p-4">
          <DailyPnlBarChart points={points} heightClassName="h-[386px]" />
        </TabsContent>
      </Tabs>
    </section>
  );
}
