'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { OrderSide, OrderType } from '../types';

export interface OrderTicketDraft {
  side: OrderSide;
  type: OrderType;
  quantity: string;
  price: string;
  stopLoss: string;
  takeProfit: string;
}

export function OrderTicket({
  open,
  onOpenChange,
  initialSide,
  symbol,
  currentPrice,
  canSubmit,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSide: OrderSide;
  symbol: string;
  currentPrice: number;
  canSubmit: boolean;
  onSubmit: (draft: OrderTicketDraft) => { ok: true } | { ok: false; message: string };
}) {
  const [side, setSide] = useState<OrderSide>(initialSide);
  const [type, setType] = useState<OrderType>('market');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setSide(initialSide);
      setError('');
    }
  }, [initialSide, open]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const result = onSubmit({ side, type, quantity, price, stopLoss, takeProfit });
    if (result.ok) onOpenChange(false);
    else setError(result.message);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="overflow-y-auto sm:max-w-md"
        aria-describedby="order-ticket-description"
      >
        <SheetHeader>
          <SheetTitle>Simulated order</SheetTitle>
          <SheetDescription id="order-ticket-description">
            Browser-session replay only. No order is sent to a broker.
          </SheetDescription>
        </SheetHeader>

        <form aria-label="Simulated order ticket" className="mt-6 space-y-5" onSubmit={submit}>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Contract</span>
              <strong>{symbol}</strong>
            </div>
            <div className="mt-1 flex justify-between gap-3">
              <span className="text-muted-foreground">Revealed close</span>
              <span className="tabular font-medium">{currentPrice.toFixed(2)}</span>
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Side</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['buy', 'sell'] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={side === value ? 'default' : 'outline'}
                  aria-pressed={side === value}
                  onClick={() => setSide(value)}
                >
                  {value === 'buy' ? 'Buy' : 'Sell'}
                </Button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="sim-order-type">Order type</Label>
            <select
              id="sim-order-type"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={type}
              onChange={(event) => setType(event.target.value as OrderType)}
            >
              <option value="market">Market</option>
              <option value="limit">Limit</option>
              <option value="stop">Stop</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sim-order-quantity">Quantity</Label>
            <Input
              id="sim-order-quantity"
              inputMode="numeric"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>

          {type !== 'market' ? (
            <div className="space-y-2">
              <Label htmlFor="sim-order-price">
                {type === 'limit' ? 'Limit price' : 'Stop price'}
              </Label>
              <Input
                id="sim-order-price"
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </div>
          ) : null}

          <fieldset className="space-y-3 rounded-lg border border-border p-3">
            <legend className="px-1 text-sm font-medium">Optional bracket</legend>
            <div className="space-y-2">
              <Label htmlFor="sim-stop-loss">Stop Loss</Label>
              <Input
                id="sim-stop-loss"
                inputMode="decimal"
                placeholder="Optional"
                value={stopLoss}
                onChange={(event) => setStopLoss(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sim-take-profit">Take Profit</Label>
              <Input
                id="sim-take-profit"
                inputMode="decimal"
                placeholder="Optional"
                value={takeProfit}
                onChange={(event) => setTakeProfit(event.target.value)}
              />
            </div>
          </fieldset>

          <div className="rounded-lg border border-border p-3 text-sm" aria-label="Order preview">
            <p className="font-medium">Order preview</p>
            <p className="mt-1 text-muted-foreground">
              {side === 'buy' ? 'Buy' : 'Sell'} {quantity || '—'} {symbol} ·{' '}
              {type === 'market'
                ? 'Market at next candle open'
                : `${type === 'limit' ? 'Limit' : 'Stop'} ${price || '—'}`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Full fills only. No slippage, P&amp;L, balance, or risk calculation.
            </p>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {!canSubmit ? (
            <p className="text-sm text-muted-foreground">
              Orders require at least one future replay candle.
            </p>
          ) : null}

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              Place simulated order
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
