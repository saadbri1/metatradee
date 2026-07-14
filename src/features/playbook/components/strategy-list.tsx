'use client';

import Link from 'next/link';
import { ClipboardList, Plus, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/features/workspace/components/states';
import type { StrategyRow } from '../types';

export function StrategyList({ strategies }: { strategies: StrategyRow[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Playbook</h1>
        <Button asChild>
          <Link href="/playbook/new">
            <Plus aria-hidden /> New strategy
          </Link>
        </Button>
      </div>

      {strategies.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-8" />}
          title="No strategies yet"
          description="Document your first strategy or start from a template."
          action={
            <Button asChild>
              <Link href="/playbook/new">Create a strategy</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {strategies.map((s) => (
            <Link
              key={s.id}
              href={`/playbook/${s.id}`}
              className="rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      {s.is_pinned ? (
                        <Star className="size-3.5 fill-warning text-warning" aria-label="Pinned" />
                      ) : null}
                      {s.name}
                    </span>
                    <Badge variant={s.status === 'active' ? 'default' : 'secondary'}>
                      {s.status}
                    </Badge>
                  </div>
                  {s.category ? (
                    <p className="text-xs text-muted-foreground">{s.category}</p>
                  ) : null}
                  {s.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">v{s.current_version}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
