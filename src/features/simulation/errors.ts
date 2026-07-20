export const SIMULATION_ERROR_CODES = [
  'invalid_order',
  'invalid_quantity',
  'invalid_price',
  'invalid_tick',
  'duplicate_order',
  'order_not_found',
  'order_not_working',
  'invalid_bracket',
  'invalid_stop_loss',
  'invalid_take_profit',
  'terminal_order',
  'unsupported_order_type',
] as const;

export type SimulationErrorCode = (typeof SIMULATION_ERROR_CODES)[number];

const ERROR_MESSAGES: Record<SimulationErrorCode, string> = {
  invalid_order: 'The order is invalid.',
  invalid_quantity: 'Quantity must be a positive whole number.',
  invalid_price: 'Enter a valid finite price.',
  invalid_tick: 'Price must align to the instrument tick size.',
  duplicate_order: 'That order ID already exists.',
  order_not_found: 'The order was not found.',
  order_not_working: 'Only working orders can be cancelled.',
  invalid_bracket: 'The bracket order is invalid.',
  invalid_stop_loss: 'The stop-loss price is not valid for this entry.',
  invalid_take_profit: 'The take-profit price is not valid for this entry.',
  terminal_order: 'A terminal order cannot be changed.',
  unsupported_order_type: 'That order type is not supported.',
};

export class SimulationError extends Error {
  constructor(readonly code: SimulationErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'SimulationError';
  }
}

export type SimulationResult<T> = { ok: true; value: T } | { ok: false; error: SimulationError };

export function simulationFailure<T>(code: SimulationErrorCode): SimulationResult<T> {
  return { ok: false, error: new SimulationError(code) };
}
