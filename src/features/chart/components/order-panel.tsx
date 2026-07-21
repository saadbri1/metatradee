'use client';

import { CircleDot, PanelRightClose, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { OrderSide, SimulatedOrder, SimulationState } from '@/features/simulation';
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
  simulation,
  onCancelOrder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: OrderSide;
  symbol: string | null;
  currentPrice: number | null;
  replayActive: boolean;
  canSubmit: boolean;
  onSubmit: (draft: OrderTicketDraft) => { ok: true } | { ok: false; message: string };
  simulation: SimulationState | null;
  onCancelOrder: (id: string) => void;
}) {
  const working =
    simulation?.orders.filter(
      (order) => order.status === 'working' || order.status === 'pending',
    ) ?? [];
  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close order panel overlay"
          className="fixed inset-0 z-40 bg-foreground/10"
          onClick={() => onOpenChange(false)}
        />
      ) : null}
      <aside
        aria-label="Simulated order panel"
        hidden={!open}
        data-state={open ? 'open' : 'closed'}
        data-responsive="desktop-overlay medium-drawer small-bottom-sheet"
        className={cn(
          /*
           * Overlay, never a column: the drawer floats above the chart so the
           * chart never loses width. `top-[3.25rem]` sits it directly under the
           * session header. Solid surface with a soft edge — a 2xl shadow reads
           * as a dark smear on light neutrals.
           */
          'fixed bottom-0 right-0 top-[3.25rem] z-50 min-h-0 w-[24rem] overflow-hidden border-l border-border bg-card shadow-lg transition-transform',
          'max-sm:inset-x-0 max-sm:top-auto max-sm:h-[min(78dvh,42rem)] max-sm:w-full max-sm:border-l-0 max-sm:border-t',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-start gap-2 border-b border-border bg-muted/40 px-3 py-2.5">
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
              {/* Contract and last revealed price — both real replay state. */}
              <p className="tabular text-[11px] text-muted-foreground">
                {symbol ? <span className="font-medium text-foreground">{symbol}</span> : null}
                {symbol && currentPrice !== null ? ' · ' : ''}
                {currentPrice !== null ? (
                  <span className="font-medium text-foreground">
                    {currentPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })}
                  </span>
                ) : null}
                {symbol || currentPrice !== null ? <br /> : null}
                Replay only · Nothing is sent to a broker
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto size-8"
              onClick={() => onOpenChange(false)}
              aria-label="Close order panel"
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
            {replayActive ? <WorkingOrders orders={working} onCancel={onCancelOrder} /> : null}
          </div>
        </div>
      </aside>
    </>
  );
}

function requestedPrice(order: SimulatedOrder): string {
  if (order.type === 'market') return 'Next open';
  const value = order.type === 'limit' ? order.limitPrice : order.stopPrice;
  return value?.toLocaleString('en-US', { maximumFractionDigits: 8 }) ?? '—';
}

function WorkingOrders({
  orders,
  onCancel,
}: {
  orders: readonly SimulatedOrder[];
  onCancel: (id: string) => void;
}) {
  return (
    <section
      aria-label="Working orders in advanced panel"
      className="mt-4 border-t border-border pt-3"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Working orders
        </h3>
        <span className="tabular text-[10px] text-muted-foreground">{orders.length}</span>
      </div>
      {orders.length === 0 ? (
        <p className="border border-border bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">
          No working orders.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {orders.map((order) => (
            <li
              key={order.id}
              className="flex items-center gap-2 border border-border bg-muted/40 px-2.5 py-2 text-xs"
            >
              <span className="font-semibold uppercase">{order.side}</span>
              <span className="tabular text-muted-foreground">{order.quantity}</span>
              <span className="capitalize text-muted-foreground">{order.type}</span>
              <span className="tabular ml-auto">{requestedPrice(order)}</span>
              {order.status === 'working' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                  onClick={() => onCancel(order.id)}
                  aria-label={`Cancel ${order.id}`}
                >
                  Cancel
                </Button>
              ) : (
                <span className="text-[10px] text-muted-foreground">Pending</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
