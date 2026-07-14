/**
 * Shared trade Zod schema — the ONE validation contract for manual and imported
 * trades (client UX + server authority + import mapping). Money/prices are
 * numbers here; the DB stores exact numeric. Cross-field rules: close ≥ open;
 * no execution/close far in the future (tolerance: 1 day).
 */
import { z } from 'zod';
import { ASSET_TYPES, DIRECTIONS, TRADE_SESSIONS, TRADE_STATUSES, TRADE_VISIBILITY } from './enums';

const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

const optionalIsoDate = z.string().datetime({ offset: true }).optional().nullable();

const nonNegative = z.number().nonnegative('Must be zero or greater');

export const tradeCreateSchema = z
  .object({
    symbol: z.string().trim().min(1, 'Symbol is required').max(40),
    direction: z.enum(DIRECTIONS),
    asset_type: z.enum(ASSET_TYPES).optional().nullable(),
    market: z.string().trim().max(60).optional().or(z.literal('')),

    trading_account_id: z.string().uuid().optional().nullable(),
    broker_id: z.string().uuid().optional().nullable(),
    strategy_id: z.string().uuid().optional().nullable(),

    entry_price: nonNegative.optional().nullable(),
    exit_price: nonNegative.optional().nullable(),
    quantity: nonNegative.optional().nullable(),
    position_size: nonNegative.optional().nullable(),
    stop_loss: nonNegative.optional().nullable(),
    take_profit: nonNegative.optional().nullable(),

    risk_percent: z.number().min(0).max(100).optional().nullable(),
    risk_amount: z.number().optional().nullable(),
    reward: z.number().optional().nullable(),
    commission: nonNegative.optional().default(0),
    swap: z.number().optional().default(0),
    fees: nonNegative.optional().default(0),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code')
      .default('USD'),

    opened_at: optionalIsoDate,
    closed_at: optionalIsoDate,
    executed_at: optionalIsoDate,

    session: z.enum(TRADE_SESSIONS).optional().nullable(),
    setup: z.string().trim().max(120).optional().or(z.literal('')),
    confidence: z.number().int().min(0).max(100).optional().nullable(),
    notes: z.string().max(5000).optional().or(z.literal('')),
    private_notes: z.string().max(5000).optional().or(z.literal('')),
    visibility: z.enum(TRADE_VISIBILITY).default('private'),
    status: z.enum(TRADE_STATUSES).default('published'),
    tag_ids: z.array(z.string().uuid()).optional().default([]),
  })
  .refine(
    (t) => !t.opened_at || !t.closed_at || Date.parse(t.closed_at) >= Date.parse(t.opened_at),
    { message: 'Close time must be on or after open time', path: ['closed_at'] },
  )
  .refine((t) => !t.closed_at || Date.parse(t.closed_at) <= Date.now() + FUTURE_TOLERANCE_MS, {
    message: 'Close time cannot be in the future',
    path: ['closed_at'],
  })
  .refine((t) => !t.executed_at || Date.parse(t.executed_at) <= Date.now() + FUTURE_TOLERANCE_MS, {
    message: 'Execution time cannot be in the future',
    path: ['executed_at'],
  });

export type TradeCreateInput = z.infer<typeof tradeCreateSchema>;

/** Update: all fields optional; cross-field date checks kept lightweight. */
export const tradeUpdateSchema = z
  .object({
    symbol: z.string().trim().min(1).max(40).optional(),
    direction: z.enum(DIRECTIONS).optional(),
    asset_type: z.enum(ASSET_TYPES).optional().nullable(),
    market: z.string().trim().max(60).optional().or(z.literal('')),
    trading_account_id: z.string().uuid().optional().nullable(),
    broker_id: z.string().uuid().optional().nullable(),
    strategy_id: z.string().uuid().optional().nullable(),
    entry_price: nonNegative.optional().nullable(),
    exit_price: nonNegative.optional().nullable(),
    quantity: nonNegative.optional().nullable(),
    position_size: nonNegative.optional().nullable(),
    stop_loss: nonNegative.optional().nullable(),
    take_profit: nonNegative.optional().nullable(),
    risk_percent: z.number().min(0).max(100).optional().nullable(),
    risk_amount: z.number().optional().nullable(),
    reward: z.number().optional().nullable(),
    commission: nonNegative.optional(),
    swap: z.number().optional(),
    fees: nonNegative.optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    opened_at: optionalIsoDate,
    closed_at: optionalIsoDate,
    executed_at: optionalIsoDate,
    session: z.enum(TRADE_SESSIONS).optional().nullable(),
    setup: z.string().trim().max(120).optional().or(z.literal('')),
    confidence: z.number().int().min(0).max(100).optional().nullable(),
    notes: z.string().max(5000).optional().or(z.literal('')),
    private_notes: z.string().max(5000).optional().or(z.literal('')),
    visibility: z.enum(TRADE_VISIBILITY).optional(),
    status: z.enum(TRADE_STATUSES).optional(),
    tag_ids: z.array(z.string().uuid()).optional(),
    is_favorite: z.boolean().optional(),
    is_pinned: z.boolean().optional(),
  })
  .refine(
    (t) => !t.opened_at || !t.closed_at || Date.parse(t.closed_at) >= Date.parse(t.opened_at),
    { message: 'Close time must be on or after open time', path: ['closed_at'] },
  );

export type TradeUpdateInput = z.infer<typeof tradeUpdateSchema>;

export const bulkTradeIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'Select at least one trade').max(1000),
});
