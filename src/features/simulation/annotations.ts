import type { SimulationState } from './types';

export interface SimulationPriceLine {
  id: string;
  price: number;
  role: 'entry' | 'stop_loss' | 'take_profit';
  side: 'buy' | 'sell';
  label: string;
}

export interface SimulationFillMarker {
  id: string;
  time: number;
  price: number;
  side: 'buy' | 'sell';
  kind: 'entry_fill' | 'exit_fill';
  label: string;
}

export function simulationPriceLines(
  state: SimulationState | null,
): readonly SimulationPriceLine[] {
  if (!state) return [];
  return state.orders
    .filter((order) => order.status === 'working' && order.type !== 'market')
    .map((order) => ({
      id: order.id,
      price: order.type === 'limit' ? order.limitPrice! : order.stopPrice!,
      role: order.role,
      side: order.side,
      label:
        order.role === 'stop_loss'
          ? 'Stop loss'
          : order.role === 'take_profit'
            ? 'Take profit'
            : `${order.side === 'buy' ? 'Buy' : 'Sell'} ${order.type}`,
    }));
}

export function simulationFillMarkers(
  state: SimulationState | null,
): readonly SimulationFillMarker[] {
  if (!state) return [];
  return state.fills.map((fill) => ({
    id: `${fill.orderId}:fill`,
    time: fill.candleTime,
    price: fill.price,
    side: fill.side,
    kind: fill.role === 'entry' ? 'entry_fill' : 'exit_fill',
    label: `${fill.side === 'buy' ? 'Buy' : 'Sell'} ${fill.role === 'entry' ? 'entry' : 'exit'} ${fill.quantity} @ ${fill.price}`,
  }));
}
