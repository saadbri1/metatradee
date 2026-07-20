'use client';

import { useEffect, useState } from 'react';
import { Minus, Plus, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatUsd, type AccountingSnapshot, type OrderSide } from '@/features/simulation';

function formatPrice(value: number | null): string {
  return value === null
    ? '—'
    : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'profit' | 'loss';
}) {
  return (
    <div className="min-w-[5rem] border-l border-border px-3 first:border-l-0">
      <span className="block text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <strong
        className={cn(
          'tabular mt-0.5 block truncate text-[11px] font-semibold text-foreground',
          tone === 'profit' && 'text-profit',
          tone === 'loss' && 'text-loss',
        )}
      >
        {value}
      </strong>
    </div>
  );
}

export function ReplayTradingBar({
  symbol,
  currentPrice,
  accounting,
  canTrade,
  onMarketOrder,
  onOpenAdvanced,
}: {
  symbol: string;
  currentPrice: number;
  accounting: AccountingSnapshot | null;
  canTrade: boolean;
  onMarketOrder: (
    side: OrderSide,
    quantity: number,
  ) => { ok: true } | { ok: false; message: string };
  onOpenAdvanced: (side?: OrderSide) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => setError(''), [currentPrice]);

  const trade = (side: OrderSide) => {
    setError('');
    const result = onMarketOrder(side, quantity);
    if (!result.ok) setError(result.message);
  };
  const realized = accounting?.realizedPnl ?? 0;
  const unrealized = accounting?.unrealizedPnl ?? 0;
  const pnlTone = (value: number): 'profit' | 'loss' | undefined =>
    value > 0 ? 'profit' : value < 0 ? 'loss' : undefined;

  return (
    <section
      aria-label="Replay trading bar"
      className="relative flex min-h-14 shrink-0 items-center gap-2 border-t border-border bg-card px-2 py-1.5"
    >
      <div role="group" aria-label="Quick market orders" className="flex shrink-0 gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-9 min-w-20 bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90"
          disabled={!canTrade}
          onClick={() => trade('buy')}
          aria-label={`Buy ${quantity} ${symbol} at next candle open`}
        >
          Buy
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-9 min-w-20 px-4 font-semibold"
          disabled={!canTrade}
          onClick={() => trade('sell')}
          aria-label={`Sell ${quantity} ${symbol} at next candle open`}
        >
          Sell
        </Button>
      </div>

      <div className="flex h-9 shrink-0 items-center border border-input bg-background/70">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-none"
          disabled={quantity <= 1}
          onClick={() => setQuantity((value) => Math.max(1, value - 1))}
          aria-label="Decrease order quantity"
        >
          <Minus aria-hidden />
        </Button>
        <label className="sr-only" htmlFor="replay-quick-quantity">
          Order quantity
        </label>
        <Input
          id="replay-quick-quantity"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={quantity}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (Number.isSafeInteger(value) && value > 0) setQuantity(value);
          }}
          className="h-8 w-14 rounded-none border-0 bg-transparent px-1 text-center text-xs shadow-none focus-visible:ring-0"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-none"
          onClick={() => setQuantity((value) => value + 1)}
          aria-label="Increase order quantity"
        >
          <Plus aria-hidden />
        </Button>
      </div>

      <div className="hidden min-w-0 flex-1 items-center overflow-x-auto md:flex">
        <Metric label="Symbol" value={symbol} />
        <Metric label="Revealed" value={formatPrice(currentPrice)} />
        <Metric label="Position" value={(accounting?.side ?? 'flat').toUpperCase()} />
        <Metric label="Pos. qty" value={String(accounting?.quantity ?? 0)} />
        <Metric label="Avg. entry" value={formatPrice(accounting?.averageEntryPrice ?? null)} />
        <Metric label="Latest exit" value={formatPrice(accounting?.latestExitPrice ?? null)} />
        <Metric label="Realized P&L" value={formatUsd(realized)} tone={pnlTone(realized)} />
        <Metric label="Unrealized P&L" value={formatUsd(unrealized)} tone={pnlTone(unrealized)} />
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="ml-auto h-9 shrink-0 gap-1.5"
        onClick={() => onOpenAdvanced()}
        aria-label="Open advanced order panel"
      >
        <SlidersHorizontal aria-hidden />
        <span className="hidden sm:inline">Advanced</span>
      </Button>

      {error ? (
        <p
          role="alert"
          className="absolute bottom-0 left-2 translate-y-full bg-card px-2 py-1 text-xs text-destructive shadow-lg"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
