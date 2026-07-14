/** Shared Zod schemas (client + server) for reports, shares, and schedules. */
import { z } from 'zod';

export const reportTypeSchema = z.enum([
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'custom',
  'strategy',
  'broker',
  'account',
  'session',
  'symbol',
  'risk',
  'psychology',
  'goal_progress',
  'ai_performance',
  'executive',
]);

export const blockKindSchema = z.enum([
  'kpis',
  'equity_curve',
  'balance_curve',
  'drawdown',
  'risk',
  'trade_distribution',
  'session_performance',
  'calendar_heatmap',
  'strategy_performance',
  'goal_progress',
  'habit_tracking',
  'psychology',
  'ai_insights',
  'rule_violations',
  'notes',
]);

export const exportFormatSchema = z.enum(['pdf', 'csv', 'xlsx', 'json', 'print']);

/** Report filters — a subset of the shared TradeFilters model (reused, not new). */
export const reportFiltersSchema = z.object({
  symbol: z.string().max(20).optional(),
  account_id: z.string().uuid().optional(),
  broker_id: z.string().uuid().optional(),
  strategy_id: z.string().uuid().optional(),
  session: z.enum(['asian', 'london', 'new_york', 'sydney']).optional(),
  direction: z.enum(['buy', 'sell']).optional(),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  tag_ids: z.array(z.string().uuid()).max(50).optional(),
});

export const reportCreateSchema = z.object({
  type: reportTypeSchema,
  title: z.string().trim().min(1, 'Title is required').max(120),
  blocks: z.array(blockKindSchema).min(1).max(20),
  filters: reportFiltersSchema.default({}),
  note: z.string().max(4000).optional(),
});
export type ReportCreateInput = z.infer<typeof reportCreateSchema>;

export const shareCreateSchema = z
  .object({
    reportId: z.string().uuid(),
    allowDownload: z.boolean().default(false),
    isPublic: z.boolean().default(false),
    includePsychology: z.boolean().default(false),
    password: z.string().min(6).max(128).optional(),
    /** ISO timestamp; must be in the future when present. */
    expiresAt: z.string().datetime().optional(),
  })
  // Hard rule mirrored from the projection: psychology is never in a public share.
  .refine((v) => !(v.isPublic && v.includePsychology), {
    message: 'Psychology data cannot be included in a public share.',
    path: ['includePsychology'],
  });
export type ShareCreateInput = z.infer<typeof shareCreateSchema>;

export const scheduleCreateSchema = z.object({
  reportId: z.string().uuid(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom']),
  deliverEmail: z.boolean().default(true),
  deliverDashboard: z.boolean().default(true),
  isPaused: z.boolean().default(false),
});
export type ScheduleCreateInput = z.infer<typeof scheduleCreateSchema>;
