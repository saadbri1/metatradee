'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { OrderSide, OrderType } from '../types';

export interface OrderTicketDraft {
  side: OrderSide;
  type: OrderType;
  quantity: string;
  price: string;
  stopLoss: string;
  takeProfit: string;
}

interface OrderFormProps {
  initialSide: OrderSide;
  symbol: string;
  currentPrice: number;
  canSubmit: boolean;
  onSubmit: (draft: OrderTicketDraft) => { ok: true } | { ok: false; message: string };
  onSubmitted?: () => void;
  submitLabel?: string;
}

export function OrderTicketForm({
  initialSide,
  symbol,
  currentPrice,
  canSubmit,
  onSubmit,
  onSubmitted,
  submitLabel = 'Place simulated order',
}: OrderFormProps) {
  const [side, setSide] = useState<OrderSide>(initialSide);
  const [type, setType] = useState<OrderType>('market');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setSide(initialSide);
    setError('');
  }, [initialSide]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const result = onSubmit({ side, type, quantity, price, stopLoss, takeProfit });
    if (result.ok) onSubmitted?.();
    else setError(result.message);
  };

  return (
    <form aria-label="Simulated order ticket" className="space-y-3" onSubmit={submit}>
      <div className="grid grid-cols-2 border border-border bg-muted/20 text-xs">
        <div className="border-r border-border px-3 py-2">
          <span className="block text-muted-foreground">Contract</span>
          <strong>{symbol}</strong>
        </div>
        <div className="px-3 py-2 text-right">
          <span className="block text-muted-foreground">Revealed price</span>
          <span className="tabular font-medium">{currentPrice.toFixed(2)}</span>
        </div>
      </div>

      <fieldset>
        <legend className="sr-only">Side</legend>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border">
          {(['buy', 'sell'] as const).map((value) => (
            <Button
              key={value}
              type="button"
              variant="ghost"
              className={`rounded-none shadow-none ${
                side === value
                  ? value === 'buy'
                    ? 'bg-profit/15 text-profit hover:bg-profit/20'
                    : 'bg-loss/15 text-loss hover:bg-loss/20'
                  : 'bg-card'
              }`}
              aria-pressed={side === value}
              onClick={() => setSide(value)}
            >
              {value === 'buy' ? 'Buy' : 'Sell'}
            </Button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="sim-order-type">Order type</Label>
        <select
          id="sim-order-type"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={type}
          onChange={(event) => setType(event.target.value as OrderType)}
        >
          <option value="market">Market</option>
          <option value="limit">Limit</option>
          <option value="stop">Stop</option>
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <div className="space-y-1.5">
          <Label htmlFor="sim-order-quantity">Quantity</Label>
          <Input
            id="sim-order-quantity"
            className="h-9"
            inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </div>
        {type !== 'market' ? (
          <div className="space-y-1.5">
            <Label htmlFor="sim-order-price">
              {type === 'limit' ? 'Limit price' : 'Stop price'}
            </Label>
            <Input
              id="sim-order-price"
              className="h-9"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </div>
        ) : null}
      </div>

      <fieldset className="space-y-2 border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">Optional bracket</legend>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="space-y-1.5">
            <Label htmlFor="sim-stop-loss">Stop Loss</Label>
            <Input
              id="sim-stop-loss"
              className="h-9"
              inputMode="decimal"
              placeholder="Optional"
              value={stopLoss}
              onChange={(event) => setStopLoss(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sim-take-profit">Take Profit</Label>
            <Input
              id="sim-take-profit"
              className="h-9"
              inputMode="decimal"
              placeholder="Optional"
              value={takeProfit}
              onChange={(event) => setTakeProfit(event.target.value)}
            />
          </div>
        </div>
      </fieldset>

      <div className="border border-border bg-muted/20 p-3 text-xs" aria-label="Order preview">
        <p className="font-medium">Order preview</p>
        <p className="mt-1 text-muted-foreground">
          {side === 'buy' ? 'Buy' : 'Sell'} {quantity || '—'} {symbol} ·{' '}
          {type === 'market'
            ? 'Market at next candle open'
            : `${type === 'limit' ? 'Limit' : 'Stop'} ${price || '—'}`}
        </p>
        <p className="mt-1 text-muted-foreground">
          Full fills only. No slippage, P&amp;L, balance, or risk calculation.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {!canSubmit ? (
        <p className="text-xs text-muted-foreground">
          Orders require at least one future replay candle.
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={!canSubmit}>
        {submitLabel}
      </Button>
    </form>
  );
}
