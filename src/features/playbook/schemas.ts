/**
 * Shared Zod schemas (client + server) for strategies, playbooks, adherence, and
 * templates. Rule groups are arrays of {id,text,required}. Imported templates are
 * validated against `templateSchema` (schema-versioned, marketplace-ready).
 */
import { z } from 'zod';
import { RULE_GROUPS } from './types';

export const ruleItemSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().trim().min(1, 'Rule text is required').max(500),
  required: z.boolean().optional(),
});

export const checklistItemSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().trim().min(1).max(300),
  required: z.boolean(),
  position: z.number().int().min(0).optional(),
});

const ruleArray = z.array(ruleItemSchema).max(100).default([]);
const strArray = z.array(z.string().trim().min(1).max(40)).max(50).default([]);

const ruleGroupShape = Object.fromEntries(RULE_GROUPS.map((g) => [g, ruleArray])) as Record<
  (typeof RULE_GROUPS)[number],
  typeof ruleArray
>;

export const strategyCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  category: z.string().trim().max(60).optional().or(z.literal('')),
  market: z.string().trim().max(60).optional().or(z.literal('')),
  asset_class: z.string().trim().max(40).optional().or(z.literal('')),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .or(z.literal('')),
  symbols: strArray,
  timeframes: strArray,
  sessions: strArray,
  ...ruleGroupShape,
  checklist: z.array(checklistItemSchema).max(100).default([]),
  notes: z.string().trim().max(4000).optional().or(z.literal('')),
  status: z.enum(['draft', 'active', 'archived']).default('active'),
});
export type StrategyCreateInput = z.infer<typeof strategyCreateSchema>;

export const strategyUpdateSchema = strategyCreateSchema.partial().extend({
  is_pinned: z.boolean().optional(),
});
export type StrategyUpdateInput = z.infer<typeof strategyUpdateSchema>;

export const playbookSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  category: z.string().trim().max(60).optional().or(z.literal('')),
  status: z.enum(['draft', 'active', 'archived']).default('active'),
});
export type PlaybookInput = z.infer<typeof playbookSchema>;

export const adherenceSchema = z.object({
  strategy_id: z.string().uuid().nullable().optional(),
  strategy_version: z.number().int().nullable().optional(),
  followed_strategy: z.boolean().nullable().optional(),
  checklist_completed_pct: z.number().min(0).max(100).nullable().optional(),
  rule_violations: z.array(z.string().max(200)).max(50).default([]),
  execution_quality: z.number().int().min(0).max(100).nullable().optional(),
  confidence: z.number().int().min(0).max(100).nullable().optional(),
  mistakes: z.array(z.string().max(200)).max(50).default([]),
  lessons: z.string().max(2000).nullable().optional(),
});
export type AdherenceInput = z.infer<typeof adherenceSchema>;

/** Marketplace-ready template content — schema-versioned, no PII / no ids. */
export const TEMPLATE_SCHEMA_VERSION = 1;

export const templateContentSchema = z.object({
  category: z.string().max(60).optional(),
  market: z.string().max(60).optional(),
  asset_class: z.string().max(40).optional(),
  symbols: strArray,
  timeframes: strArray,
  sessions: strArray,
  ...ruleGroupShape,
  checklist: z.array(checklistItemSchema).max(100).default([]),
});
export type TemplateContent = z.infer<typeof templateContentSchema>;

export const templateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  schema_version: z.number().int().min(1),
  author: z.string().max(80).optional().nullable(),
  content: templateContentSchema,
});
export type TemplatePayload = z.infer<typeof templateSchema>;
