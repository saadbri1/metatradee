/**
 * Portable strategy templates — sanitized (no PII, no ids, no other users' data),
 * schema-versioned for a future marketplace to consume WITHOUT refactoring.
 * Export produces a plain data structure (not a file — Reports/export engine is
 * out of scope); import validates against the Zod schema.
 */
import { RULE_GROUPS } from './types';
import type { RuleItem, StrategyRow } from './types';
import type { StrategyCreateInput } from './schemas';
import {
  TEMPLATE_SCHEMA_VERSION,
  templateSchema,
  type TemplateContent,
  type TemplatePayload,
} from './schemas';

export { TEMPLATE_SCHEMA_VERSION };

/** Build sanitized template content from a strategy (drops ids/user/timestamps). */
export function strategyToTemplateContent(s: StrategyRow): TemplateContent {
  const content: Record<string, unknown> = {
    category: s.category ?? undefined,
    market: s.market ?? undefined,
    asset_class: s.asset_class ?? undefined,
    symbols: s.symbols ?? [],
    timeframes: s.timeframes ?? [],
    sessions: s.sessions ?? [],
    checklist: s.checklist ?? [],
  };
  for (const g of RULE_GROUPS) content[g] = s[g] ?? [];
  return content as TemplateContent;
}

export function exportTemplate(s: StrategyRow, author?: string): TemplatePayload {
  return {
    name: s.name,
    schema_version: TEMPLATE_SCHEMA_VERSION,
    author: author ?? null,
    content: strategyToTemplateContent(s),
  };
}

/** Validate an imported template payload against the schema (+ version check). */
export function validateTemplate(
  payload: unknown,
): { ok: true; data: TemplatePayload } | { ok: false; error: string } {
  const parsed = templateSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: 'Invalid template format.' };
  if (parsed.data.schema_version > TEMPLATE_SCHEMA_VERSION) {
    return { ok: false, error: 'Template uses a newer schema version.' };
  }
  return { ok: true, data: parsed.data };
}

/** Instantiate a new strategy create-input from a template. */
export function templateToStrategyInput(
  content: TemplateContent,
  name: string,
): StrategyCreateInput {
  const ruleGroups = Object.fromEntries(
    RULE_GROUPS.map((g) => [g, (content[g] as RuleItem[] | undefined) ?? []]),
  );
  return {
    name,
    description: '',
    category: content.category ?? '',
    market: content.market ?? '',
    asset_class: content.asset_class ?? '',
    color: '',
    symbols: content.symbols ?? [],
    timeframes: content.timeframes ?? [],
    sessions: content.sessions ?? [],
    checklist: content.checklist ?? [],
    notes: '',
    status: 'draft',
    ...ruleGroups,
  } as StrategyCreateInput;
}
