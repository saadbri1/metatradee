'use client';

/**
 * Filter popover. Every option maps to real stored data — playbook category,
 * symbols actually traded, trade direction, Net P&L outcome, linked-trade count,
 * and review state. Nothing here filters on a value MetaTradee does not hold.
 *
 * Edits are staged locally and committed on Apply, so the table does not
 * re-sort under the user mid-selection.
 */
import { useEffect, useState } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { activeFilterCount, type PlaybookFilters } from '../filters';

const ANY = 'any';

export function PlaybookFilterPanel({
  filters,
  categories,
  symbols,
  reviewedAvailable,
  onApply,
  onReset,
}: {
  filters: PlaybookFilters;
  categories: string[];
  symbols: string[];
  reviewedAvailable: boolean;
  onApply: (next: PlaybookFilters) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PlaybookFilters>(filters);
  const count = activeFilterCount(filters);

  // Re-seed the draft whenever the committed filters change (including Reset
  // from the toolbar) so the panel never shows stale selections.
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  function set<K extends keyof PlaybookFilters>(key: K, value: PlaybookFilters[K]) {
    setDraft((previous) => {
      const next = { ...previous };
      if (value === undefined || value === ('' as never)) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <Filter className="size-3.5" aria-hidden />
          Filters
          {count > 0 ? (
            <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 p-4">
        <p className="text-sm font-semibold">Filter playbooks</p>

        <div className="space-y-1.5">
          <Label htmlFor="playbook-filter-category" className="text-xs">
            Category
          </Label>
          <Select
            value={draft.category ?? ANY}
            onValueChange={(v) => set('category', v === ANY ? undefined : v)}
          >
            <SelectTrigger id="playbook-filter-category" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any category</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="playbook-filter-symbol" className="text-xs">
            Traded symbol
          </Label>
          <Select
            value={draft.symbol ?? ANY}
            onValueChange={(v) => set('symbol', v === ANY ? undefined : v)}
          >
            <SelectTrigger id="playbook-filter-symbol" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any symbol</SelectItem>
              {symbols.map((symbol) => (
                <SelectItem key={symbol} value={symbol}>
                  {symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="playbook-filter-direction" className="text-xs">
              Side traded
            </Label>
            <Select
              value={draft.direction ?? ANY}
              onValueChange={(v) => set('direction', v === ANY ? undefined : (v as 'buy' | 'sell'))}
            >
              <SelectTrigger id="playbook-filter-direction" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Both</SelectItem>
                <SelectItem value="buy">Long</SelectItem>
                <SelectItem value="sell">Short</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="playbook-filter-outcome" className="text-xs">
              Outcome
            </Label>
            <Select
              value={draft.outcome ?? ANY}
              onValueChange={(v) =>
                set('outcome', v === ANY ? undefined : (v as 'profitable' | 'losing'))
              }
            >
              <SelectTrigger id="playbook-filter-outcome" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any</SelectItem>
                <SelectItem value="profitable">Profitable</SelectItem>
                <SelectItem value="losing">Losing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="playbook-filter-min-trades" className="text-xs">
              Min. trades
            </Label>
            <Input
              id="playbook-filter-min-trades"
              type="number"
              min={0}
              inputMode="numeric"
              className="h-9"
              value={draft.min_trades ?? ''}
              onChange={(event) => {
                const value = Number(event.target.value);
                set('min_trades', Number.isFinite(value) && value > 0 ? value : undefined);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="playbook-filter-reviewed" className="text-xs">
              Review state
            </Label>
            <Select
              disabled={!reviewedAvailable}
              value={draft.reviewed ?? ANY}
              onValueChange={(v) =>
                set('reviewed', v === ANY ? undefined : (v as 'reviewed' | 'unreviewed'))
              }
            >
              <SelectTrigger
                id="playbook-filter-reviewed"
                className="h-9"
                aria-describedby={reviewedAvailable ? undefined : 'playbook-reviewed-reason'}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any</SelectItem>
                <SelectItem value="reviewed">Fully reviewed</SelectItem>
                <SelectItem value="unreviewed">Has unreviewed</SelectItem>
              </SelectContent>
            </Select>
            {!reviewedAvailable ? (
              <p id="playbook-reviewed-reason" className="text-[10px] text-muted-foreground">
                Unavailable until the trade review migration is applied.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft({});
              onReset();
              setOpen(false);
            }}
          >
            <RotateCcw className="size-3.5" aria-hidden /> Reset
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
          >
            Apply filters
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
