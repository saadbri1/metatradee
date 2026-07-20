'use client';

import { CircleDot, PanelRightClose, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { OrderSide } from '@/features/simulation';
import {
  OrderTicketForm,
  type OrderTicketDraft,
} from '@/features/simulation/components/order-ticket';

export function OrderPanel({
  open,
  onOpenChange,
  side,
  symbol,
  currentPrice,
  replayActive,
  canSubmit,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: OrderSide;
  symbol: string | null;
  currentPrice: number | null;
  replayActive: boolean;
  canSubmit: boolean;
  onSubmit: (draft: OrderTicketDraft) => { ok: true } | { ok: false; message: string };
}) {
  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close order panel overlay"
          className="fixed inset-0 z-30 bg-background/70 xl:hidden"
          onClick={() => onOpenChange(false)}
        />
      ) : null}
      <aside
        aria-label="Simulated order panel"
        hidden={!open}
        data-state={open ? 'open' : 'closed'}
        data-responsive="desktop-persistent medium-drawer small-bottom-sheet"
        className={cn(
          'min-h-0 overflow-hidden border-l border-border bg-card/95 xl:col-start-3 xl:row-span-2 xl:row-start-1 2xl:col-start-4',
          'max-xl:fixed max-xl:bottom-0 max-xl:right-0 max-xl:top-14 max-xl:z-40 max-xl:w-80 max-xl:shadow-2xl max-xl:transition-transform',
          'max-sm:inset-x-0 max-sm:top-auto max-sm:h-[min(78dvh,42rem)] max-sm:w-full max-sm:border-l-0 max-sm:border-t',
          open ? 'max-xl:translate-x-0' : 'max-xl:translate-x-full xl:hidden',
        )}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-start gap-2 border-b border-border bg-muted/20 px-3 py-2.5">
            <span className="mt-0.5 flex size-7 items-center justify-center border border-primary/25 bg-primary/10 text-primary">
              <ShoppingCart className="size-3.5" aria-hidden />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Simulated order</h2>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em]',
                    replayActive
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground',
                  )}
                >
                  <CircleDot className="size-2.5" aria-hidden />
                  {replayActive ? 'Replay active' : 'Standby'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Replay only · Nothing is sent to a broker
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto size-8"
              onClick={() => onOpenChange(false)}
              aria-label="Collapse order panel"
            >
              <PanelRightClose aria-hidden />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {replayActive && symbol && currentPrice !== null ? (
              <OrderTicketForm
                initialSide={side}
                symbol={symbol}
                currentPrice={currentPrice}
                canSubmit={canSubmit}
                onSubmit={onSubmit}
              />
            ) : (
              <div className="flex h-full min-h-48 flex-col items-center justify-center px-5 text-center">
                <span className="flex size-10 items-center justify-center border border-border bg-muted/30">
                  <ShoppingCart className="size-5 text-muted-foreground" aria-hidden />
                </span>
                <p className="mt-3 text-sm font-medium">Orders activate during replay</p>
                <p className="mt-1 max-w-56 text-xs leading-relaxed text-muted-foreground">
                  Load real candles and start replay to place deterministic browser-session orders.
                </p>
                <div className="mt-4 grid w-full max-w-52 grid-cols-2 gap-px border border-border bg-border text-[10px] text-muted-foreground">
                  <span className="bg-card px-2 py-1.5">Buy shortcut</span>
                  <kbd className="bg-card px-2 py-1.5 font-mono text-foreground">B</kbd>
                  <span className="bg-card px-2 py-1.5">Sell shortcut</span>
                  <kbd className="bg-card px-2 py-1.5 font-mono text-foreground">S</kbd>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
