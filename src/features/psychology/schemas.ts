/** Shared Zod schemas (client + server) for goals, habits, and psychology. */
import { z } from 'zod';

const rating = z.number().int().min(0).max(100).nullable().optional();

export const goalSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  goal_type: z
    .enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'])
    .default('custom'),
  metric: z.enum([
    'max_daily_loss',
    'max_trades_per_day',
    'win_rate',
    'avg_rr',
    'profit_target',
    'drawdown_limit',
    'consistency',
    'trading_days',
    'habit',
    'custom',
  ]),
  target_value: z.number().finite(),
  direction: z.enum(['gte', 'lte']).default('gte'),
  period_start: z.string().date().nullable().optional(),
  period_end: z.string().date().nullable().optional(),
  status: z.enum(['active', 'completed', 'failed', 'archived']).default('active'),
});
export type GoalInput = z.infer<typeof goalSchema>;

export const habitSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  habit_type: z
    .enum([
      'pre_market',
      'journal',
      'review',
      'meditation',
      'sleep',
      'exercise',
      'rule_compliance',
      'custom',
    ])
    .default('custom'),
  cadence: z.enum(['daily', 'weekly']).default('daily'),
  target_per_week: z.number().int().min(1).max(7).default(7),
  freeze_tokens: z.number().int().min(0).max(31).default(2),
  is_active: z.boolean().default(true),
});
export type HabitInput = z.infer<typeof habitSchema>;

export const habitLogSchema = z.object({
  habit_id: z.string().uuid(),
  log_date: z.string().date(),
  completed: z.boolean().default(false),
  is_rest_day: z.boolean().default(false),
  note: z.string().max(500).nullable().optional(),
});
export type HabitLogInput = z.infer<typeof habitLogSchema>;

export const psychologyEntrySchema = z.object({
  trade_id: z.string().uuid().nullable().optional(),
  phase: z.enum(['before', 'during', 'after', 'general']).default('general'),
  emotion: z.string().max(40).nullable().optional(),
  confidence: rating,
  stress: rating,
  focus: rating,
  discipline: rating,
  motivation: rating,
  energy: rating,
  notes: z.string().max(4000).nullable().optional(),
  entry_date: z.string().date(),
});
export type PsychologyEntryInput = z.infer<typeof psychologyEntrySchema>;
