'use client';

import { Button } from '@/components/ui/button';
import type { SimulatedOrder, SimulationState } from '../types';

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 10)}…` : id;
}

function statusClass(status: string): string {
  if (status === 'working' || status === 'pending') {
    return 'border-warning/30 bg-warning/10 text-warning';
  }
  if (status === 'filled') return 'border-primary/30 bg-primary/10 text-primary';
  return 'border-border bg-muted/30 text-muted-foreground';
}

function requestedPrice(order: SimulatedOrder): string {
  if (order.type === 'market') return 'Next open';
  return String(order.type === 'limit' ? order.limitPrice : order.stopPrice);
}

function formatTime(time: number | undefined): string {
  return time ? new Date(time * 1000).toISOString().slice(11, 19) : '—';
}

export function OrdersPanel({
  state,
  onCancel,
}: {
  state: SimulationState;
  onCancel: (id: string) => void;
}) {
  return (
    <section
      aria-labelledby="simulated-orders-heading"
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="border-b border-border px-4 py-3">
        <h2 id="simulated-orders-heading" className="font-medium">
          Simulated orders
        </h2>
        <p className="text-xs text-muted-foreground">
          Browser-session only · No positions or P&amp;L
        </p>
      </div>
      <div className="overflow-x-auto">
        <OrdersTable state={state} onCancel={onCancel} />
      </div>
    </section>
  );
}

export function OrdersTable({
  state,
  onCancel,
}: {
  state: SimulationState;
  onCancel: (id: string) => void;
}) {
  return (
    <table className="w-full text-left text-xs">
      <caption className="sr-only">
        Accessible textual record of all simulated replay orders and chart annotations.
      </caption>
      <thead className="sticky top-0 z-10 border-b border-border bg-muted/80 text-[10px] uppercase tracking-[0.08em] text-muted-foreground backdrop-blur-sm">
        <tr>
          {[
            'Order',
            'Side',
            'Type',
            'Qty',
            'Requested',
            'Fill',
            'Status',
            'Created',
            'Updated',
            'Bracket',
            'Action',
          ].map((label) => (
            <th key={label} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {state.orders.length === 0 ? (
          <tr>
            <td colSpan={11} className="px-3 py-6 text-center text-muted-foreground">
              No simulated orders in this replay session.
            </td>
          </tr>
        ) : null}
        {state.orders.map((order) => (
          <tr key={order.id} className="transition-colors hover:bg-muted/20">
            <td className="px-3 py-2 font-mono" title={order.id}>
              {shortId(order.id)}
            </td>
            <td className="px-3 py-2 font-medium">{order.side === 'buy' ? 'Buy' : 'Sell'}</td>
            <td className="px-3 py-2 capitalize">{order.type}</td>
            <td className="tabular px-3 py-2">{order.quantity}</td>
            <td className="tabular px-3 py-2">{requestedPrice(order)}</td>
            <td className="tabular px-3 py-2">{order.filledPrice ?? '—'}</td>
            <td className="px-3 py-2">
              <span
                className={`inline-flex border px-1.5 py-0.5 text-[10px] font-medium capitalize ${statusClass(order.status)}`}
              >
                {order.status}
              </span>
            </td>
            <td className="tabular px-3 py-2">{formatTime(order.createdCandleTime)}</td>
            <td className="tabular px-3 py-2">
              {formatTime(order.filledCandleTime ?? order.cancelledCandleTime)}
            </td>
            <td className="px-3 py-2">
              {order.role === 'entry'
                ? 'Entry'
                : `${order.role === 'stop_loss' ? 'Stop loss' : 'Take profit'} · ${order.parentOrderId ? shortId(order.parentOrderId) : '—'}${order.ocoGroupId ? ' · OCO' : ''}`}
            </td>
            <td className="px-3 py-2">
              {order.status === 'working' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => onCancel(order.id)}
                >
                  Cancel
                </Button>
              ) : (
                '—'
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
