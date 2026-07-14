/**
 * Owner-scoped report data gathering. Reads the SAME engines the app uses
 * (9.8 analytics + breakdowns, 9.11 psychology) filtered to the report's scope,
 * so every figure reconciles with the app exactly. Psychology is fetched only
 * when a report actually includes a psychology/habit block (least-privilege).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAnalyticsTrades } from '@/features/analytics/server/queries';
import { computeAnalyticsSummary, computeBreakdown } from '@/features/analytics';
import { getPsychologyOverview } from '@/features/psychology/server/queries';
import type { TradeFilters } from '@/features/journal/filters';
import { renderReport, type EngineBundle } from '../render';
import {
  SENSITIVE_BLOCKS,
  type BlockKind,
  type RenderedReport,
  type ReportDefinition,
} from '../types';

/** Build the engine bundle for a report definition (owner-scoped). */
export async function gatherEngineBundle(
  supabase: SupabaseClient,
  userId: string,
  blocks: BlockKind[],
  filters: TradeFilters,
): Promise<EngineBundle> {
  const trades = await fetchAnalyticsTrades(supabase, userId, filters);
  const bundle: EngineBundle = {
    analytics: computeAnalyticsSummary(trades),
    sessionBreakdown: computeBreakdown(trades, 'session'),
    strategyBreakdown: computeBreakdown(trades, 'strategy'),
    symbolBreakdown: computeBreakdown(trades, 'symbol'),
  };

  // Sensitive psychology data only when the report includes it.
  if (blocks.some((b) => SENSITIVE_BLOCKS.has(b))) {
    const psych = await getPsychologyOverview(supabase, userId);
    bundle.psychology = psych;
    bundle.habits = psych.habits;
    bundle.goals = psych.goals;
  } else if (blocks.includes('goal_progress')) {
    const psych = await getPsychologyOverview(supabase, userId);
    bundle.goals = psych.goals;
  }

  return bundle;
}

/** Render a report definition against freshly-gathered, owner-scoped engine data. */
export async function generateRenderedReport(
  supabase: SupabaseClient,
  userId: string,
  def: ReportDefinition,
): Promise<RenderedReport> {
  const bundle = await gatherEngineBundle(supabase, userId, def.blocks, def.filters);
  return renderReport(def, bundle);
}
