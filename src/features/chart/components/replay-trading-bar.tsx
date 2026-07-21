'use client';

import { useEffect, useState } from 'react';
import { Minus, Plus, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  formatUsd,
  formatUsdAmount,
  type DemoAccountSnapshot,
  type OrderSide,
} from '@/features/simulation';

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
    <div
      className="min-w-[5rem] border-l border-border px-3 first:border-l-0"
      aria-label={`${label}: ${value}`}
    >
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
  account,
  canTrade,
  onMarketOrder,
  onOpenAdvanced,
}: {
  symbol: string;
  currentPrice: number;
  account: DemoAccountSnapshot;
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
  const realized = account.realizedPnl;
  const unrealized = account.unrealizedPnl ?? 0;
  const pnlTone = (value: number): 'profit' | 'loss' | undefined =>
    value > 0 ? 'profit' : value < 0 ? 'loss' : undefined;

  return (
    <section
      aria-label="Replay trading bar"
      /*
       * A ROW inside the shared replay terminal, not a card of its own. The
       * border-top and background live on the terminal container so the trading
       * row and the transport row read as one instrument instead of two stacked
       * strips — which also returns their duplicated chrome to the chart.
       */
      className="relative flex min-h-11 shrink-0 items-center gap-1.5 px-2 py-1"
    >
      <div role="group" aria-label="Quick market orders" className="flex shrink-0 gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-8 min-w-16 bg-primary px-3 font-semibold text-primary-foreground hover:bg-primary/90"
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
          className="h-8 min-w-16 px-3 font-semibold"
          disabled={!canTrade}
          onClick={() => trade('sell')}
          aria-label={`Sell ${quantity} ${symbol} at next candle open`}
        >
          Sell
        </Button>
      </div>

      <div className="flex h-8 shrink-0 items-center border border-input bg-background/70">
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
        <Metric label="Demo balance" value={formatUsdAmount(account.balance)} />
        <Metric
          label="Equity"
          value={formatUsdAmount(account.equity)}
          tone={pnlTone(account.totalPnl)}
        />
        <Metric label="Position" value={account.side.toUpperCase()} />
        <Metric label="Pos. qty" value={String(account.quantity)} />
        <Metric label="Avg. entry" value={formatPrice(account.averageEntryPrice)} />
        <Metric label="Latest exit" value={formatPrice(account.latestExitPrice)} />
        <Metric label="Realized P&L" value={formatUsd(realized)} tone={pnlTone(realized)} />
        <Metric label="Unrealized P&L" value={formatUsd(unrealized)} tone={pnlTone(unrealized)} />
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="ml-auto h-8 shrink-0 gap-1.5"
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
