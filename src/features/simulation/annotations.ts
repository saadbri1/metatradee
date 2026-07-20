import type { SimulationState } from './types';
import { applyFill, FLAT_POSITION, type PositionState } from './accounting';
import type { InstrumentSpecification } from './instruments';

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
  position?: Pick<PositionState, 'side' | 'quantity' | 'averageEntryPrice'> | null,
): readonly SimulationPriceLine[] {
  const working = state
    ? state.orders
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
        }))
    : [];
  if (!position || position.side === 'flat' || position.averageEntryPrice === null) {
    return working;
  }
  return [
    ...working,
    {
      id: 'position:average-entry',
      price: position.averageEntryPrice,
      role: 'entry',
      side: position.side === 'long' ? 'buy' : 'sell',
      label: `Average entry · ${position.quantity} ${position.side}`,
    },
  ];
}

export function simulationFillMarkers(
  state: SimulationState | null,
  specification?: InstrumentSpecification | null,
): readonly SimulationFillMarker[] {
  if (!state) return [];
  let position = FLAT_POSITION;
  return state.fills.map((fill) => {
    let action: 'entry' | 'add' | 'reduce' | 'exit' | 'reverse' =
      fill.role === 'entry' ? 'entry' : 'exit';
    if (specification) {
      const fillDirection = fill.side === 'buy' ? 'long' : 'short';
      if (position.side === 'flat') action = 'entry';
      else if (position.side === fillDirection) action = 'add';
      else if (fill.quantity < position.quantity) action = 'reduce';
      else if (fill.quantity === position.quantity) action = 'exit';
      else action = 'reverse';
      position = applyFill(position, fill, specification);
    }
    const kind = action === 'entry' || action === 'add' ? 'entry_fill' : 'exit_fill';
    return {
      id: `${fill.orderId}:fill`,
      time: fill.candleTime,
      price: fill.price,
      side: fill.side,
      kind,
      label: `${fill.side === 'buy' ? 'Buy' : 'Sell'} ${action} ${fill.quantity} @ ${fill.price}`,
    };
  });
}
