'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TradeRow } from '../types';
import { Money, Rr } from './pnl';

/** Card view for a trade (grid layout). */
export function TradeCard({ trade }: { trade: TradeRow }) {
  return (
    <Card className="transition-colors hover:border-primary/40">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <Link
            href={`/journal/${trade.id}`}
            className="flex items-center gap-2 font-medium hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {trade.is_favorite ? (
              <Star className="size-3.5 fill-warning text-warning" aria-label="Favorite" />
            ) : null}
            {trade.symbol}
          </Link>
          <Badge variant={trade.direction === 'buy' ? 'default' : 'secondary'}>
            {trade.direction === 'buy' ? 'Long' : 'Short'}
          </Badge>
        </div>
        <div className="flex items-end justify-between">
          <Money
            value={trade.net_pnl}
            currency={trade.currency}
            colored
            className={cn('text-lg')}
          />
          <Rr value={trade.rr_ratio} />
        </div>
        <p className="text-xs text-muted-foreground">
          {trade.closed_at ? new Date(trade.closed_at).toLocaleDateString() : 'Open'}
        </p>
      </CardContent>
    </Card>
  );
}
