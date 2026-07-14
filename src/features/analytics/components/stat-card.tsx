import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

/** KPI tile (StatCard). Value is pre-formatted by the caller; context optional. */
export function StatCard({
  label,
  value,
  context,
}: {
  label: string;
  value: ReactNode;
  context?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="tabular text-xl font-semibold">{value}</p>
        {context ? <p className="text-xs text-muted-foreground">{context}</p> : null}
      </CardContent>
    </Card>
  );
}
