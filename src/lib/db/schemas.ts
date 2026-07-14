/**
 * Shared Zod schemas for the 9.3 core tables. Reused on client (RHF) and server
 * (action re-validation). Mirrors the migration's CHECK constraints so the DB is
 * never the first line of defense.
 */
import { z } from 'zod';
import { ACCOUNT_STATUSES, ACCOUNT_TYPES, ATTACHMENT_KINDS, TAG_CATEGORIES } from './enums';

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Use a 6-digit hex color, e.g. #5B6CFF');

export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code, e.g. USD');

// --- strategies ------------------------------------------------------------
export const strategyCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name is too long'),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  color: hexColorSchema.optional(),
});
export type StrategyCreateInput = z.infer<typeof strategyCreateSchema>;

export const strategyUpdateSchema = strategyCreateSchema.partial().extend({
  is_archived: z.boolean().optional(),
});
export type StrategyUpdateInput = z.infer<typeof strategyUpdateSchema>;

// --- tags ------------------------------------------------------------------
export const tagCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(40, 'Name is too long'),
  category: z.enum(TAG_CATEGORIES).default('custom'),
  color: hexColorSchema.optional(),
});
export type TagCreateInput = z.infer<typeof tagCreateSchema>;

export const tagUpdateSchema = tagCreateSchema.partial();
export type TagUpdateInput = z.infer<typeof tagUpdateSchema>;

// --- attachments -----------------------------------------------------------
export const attachmentCreateSchema = z.object({
  bucket: z.string().min(1),
  path: z.string().min(1).max(1024),
  kind: z.enum(ATTACHMENT_KINDS).default('other'),
  mime_type: z.string().min(1).max(255).optional(),
  size_bytes: z.number().int().nonnegative().optional(),
  width: z.number().int().nonnegative().optional(),
  height: z.number().int().nonnegative().optional(),
});
export type AttachmentCreateInput = z.infer<typeof attachmentCreateSchema>;

// --- trading_accounts ------------------------------------------------------
export const tradingAccountCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name is too long'),
  broker: z.string().trim().max(80).optional().or(z.literal('')),
  account_type: z.enum(ACCOUNT_TYPES).default('live'),
  base_currency: currencySchema.default('USD'),
  starting_balance: z.number().nonnegative('Balance cannot be negative').default(0),
  status: z.enum(ACCOUNT_STATUSES).default('active'),
  is_default: z.boolean().optional(),
});
export type TradingAccountCreateInput = z.infer<typeof tradingAccountCreateSchema>;

export const tradingAccountUpdateSchema = tradingAccountCreateSchema.partial();
export type TradingAccountUpdateInput = z.infer<typeof tradingAccountUpdateSchema>;
