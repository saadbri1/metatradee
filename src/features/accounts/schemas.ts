import { z } from 'zod';
import { ACCOUNT_TYPES, ACCOUNT_STATUSES } from './types';

const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency');
const money = z.coerce.number().finite().min(0).max(1_000_000_000);

export const accountCreateSchema = z
  .object({
    account_type: z.enum(ACCOUNT_TYPES),
    name: z.string().trim().min(1, 'Account name is required').max(80),
    provider: z.string().trim().max(80).optional().or(z.literal('')),
    external_account_identifier: z.string().trim().max(120).optional().or(z.literal('')),
    base_currency: currency.default('USD'),
    starting_balance: money.default(0),
    account_size: money.optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.account_type === 'broker' || value.account_type === 'funded') && !value.provider) {
      ctx.addIssue({ code: 'custom', path: ['provider'], message: 'Provider or firm is required' });
    }
    if (value.account_type === 'demo' && value.starting_balance <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['starting_balance'],
        message: 'Starting balance must be greater than zero',
      });
    }
    if (value.account_type === 'funded' && (!value.account_size || value.account_size <= 0)) {
      ctx.addIssue({ code: 'custom', path: ['account_size'], message: 'Account size is required' });
    }
  });

export const accountStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(ACCOUNT_STATUSES),
});

export type AccountCreateInput = z.infer<typeof accountCreateSchema>;
