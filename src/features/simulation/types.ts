import type { Candle } from '@/features/chart/types';

export const ORDER_SIDES = ['buy', 'sell'] as const;
export type OrderSide = (typeof ORDER_SIDES)[number];

export const ORDER_TYPES = ['market', 'limit', 'stop'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const ORDER_STATUSES = ['pending', 'working', 'filled', 'cancelled', 'rejected'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const BRACKET_ROLES = ['entry', 'stop_loss', 'take_profit'] as const;
export type BracketRole = (typeof BRACKET_ROLES)[number];

export interface OrderRequest {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  role?: BracketRole;
  parentOrderId?: string;
  ocoGroupId?: string;
}

export interface BracketRequest {
  entry: OrderRequest;
  stopLoss?: { id: string; price: number };
  takeProfit?: { id: string; price: number };
  ocoGroupId: string;
  /** Explicit revealed price used only when a market entry has no requested price. */
  entryReferencePrice?: number;
}

export interface OrderContext {
  cursor: number;
  candleTime: number;
}

export interface SimulatedOrder extends OrderRequest {
  sequence: number;
  role: BracketRole;
  status: OrderStatus;
  createdCursor: number;
  createdCandleTime: number;
  /** Fills are eligible only when a processed cursor is greater than this value. */
  eligibleAfterCursor: number;
  filledPrice?: number;
  filledCandleTime?: number;
  filledCursor?: number;
  cancelledCandleTime?: number;
  cancelledCursor?: number;
  rejectionCode?: string;
}

export interface SimulatedFill {
  sequence: number;
  orderId: string;
  side: OrderSide;
  quantity: number;
  price: number;
  candleTime: number;
  cursor: number;
  role: BracketRole;
}

export interface SimulationState {
  readonly orders: readonly SimulatedOrder[];
  readonly fills: readonly SimulatedFill[];
  readonly nextSequence: number;
  readonly currentCursor: number;
  readonly currentCandleTime: number | null;
}

export interface ProcessedCandle {
  cursor: number;
  candle: Candle;
}
