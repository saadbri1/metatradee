'use client';

import { PanelRightClose, ShoppingCart } from 'lucide-react';
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
          'min-h-0 overflow-hidden border-l border-border bg-card xl:col-start-3 xl:row-span-2 xl:row-start-1',
          'max-xl:fixed max-xl:bottom-0 max-xl:right-0 max-xl:top-14 max-xl:z-40 max-xl:w-80 max-xl:shadow-2xl max-xl:transition-transform',
          'max-sm:inset-x-0 max-sm:top-auto max-sm:h-[min(78dvh,42rem)] max-sm:w-full max-sm:border-l-0 max-sm:border-t',
          open ? 'max-xl:translate-x-0' : 'max-xl:translate-x-full xl:hidden',
        )}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-start gap-2 border-b border-border px-3 py-2.5">
            <ShoppingCart className="mt-0.5 size-4 text-primary" aria-hidden />
            <div>
              <h2 className="text-sm font-medium">Simulated order</h2>
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
              <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 px-5 text-center">
                <ShoppingCart className="size-6 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">Orders activate during replay</p>
                <p className="text-xs text-muted-foreground">
                  Load real candles and start replay to place browser-session simulated orders.
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
