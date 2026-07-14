'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import type { TradeRow } from '../types';
import { Money, Rr } from './pnl';

/**
 * Virtualized trade table. Only visible rows are rendered (via
 * @tanstack/react-virtual), so 100k+ rows scroll smoothly with bounded DOM.
 * Uses ARIA grid semantics; each row links to the trade detail (keyboard-
 * accessible), with a selection checkbox for bulk actions.
 */
export function TradeTable({
  items,
  selected,
  onToggle,
  onToggleAll,
}: {
  items: TradeRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 12,
  });

  const allSelected = items.length > 0 && items.every((t) => selected.has(t.id));

  return (
    <div className="rounded-lg border border-border">
      <div role="grid" aria-rowcount={items.length} aria-label="Trades" className="text-sm">
        <div
          role="row"
          className="flex items-center gap-3 border-b border-border bg-muted/40 px-3 py-2 font-medium text-muted-foreground"
        >
          <span role="columnheader" className="w-6">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(c) => onToggleAll(c === true)}
              aria-label="Select all trades"
            />
          </span>
          <span role="columnheader" className="flex-1">
            Symbol
          </span>
          <span role="columnheader" className="hidden w-20 sm:block">
            Side
          </span>
          <span role="columnheader" className="w-28 text-right">
            Net P&amp;L
          </span>
          <span role="columnheader" className="hidden w-16 text-right md:block">
            R:R
          </span>
          <span role="columnheader" className="hidden w-40 md:block">
            Closed
          </span>
        </div>

        <div ref={parentRef} className="max-h-[65vh] overflow-auto">
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((v) => {
              const t = items[v.index];
              if (!t) return null;
              return (
                <div
                  key={t.id}
                  role="row"
                  className="absolute inset-x-0 flex items-center gap-3 border-b border-border px-3 hover:bg-accent/50"
                  style={{ height: v.size, transform: `translateY(${v.start}px)` }}
                >
                  <span role="gridcell" className="w-6">
                    <Checkbox
                      checked={selected.has(t.id)}
                      onCheckedChange={() => onToggle(t.id)}
                      aria-label={`Select ${t.symbol}`}
                    />
                  </span>
                  <Link
                    href={`/journal/${t.id}`}
                    role="gridcell"
                    className="flex flex-1 items-center gap-2 truncate rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {t.is_favorite ? (
                      <Star className="size-3.5 fill-warning text-warning" aria-label="Favorite" />
                    ) : null}
                    <span className="truncate font-medium">{t.symbol}</span>
                  </Link>
                  <span
                    role="gridcell"
                    className={cn(
                      'hidden w-20 text-xs sm:block',
                      t.direction === 'buy' ? 'text-profit' : 'text-loss',
                    )}
                  >
                    {t.direction === 'buy' ? 'Long' : 'Short'}
                  </span>
                  <span role="gridcell" className="w-28 text-right">
                    <Money value={t.net_pnl} currency={t.currency} colored />
                  </span>
                  <span role="gridcell" className="hidden w-16 text-right md:block">
                    <Rr value={t.rr_ratio} />
                  </span>
                  <span
                    role="gridcell"
                    className="hidden w-40 text-xs text-muted-foreground md:block"
                  >
                    {t.closed_at ? new Date(t.closed_at).toLocaleString() : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
