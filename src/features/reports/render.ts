/**
 * Report render engine. Turns a ReportDefinition into a RenderedReport by
 * COPYING slices out of the pre-computed engine bundle (9.8–9.12). There is no
 * math here — every figure is the engine's own output, so a report reconciles
 * with the app by construction. Blocks with no available source render as empty
 * (honest) rather than fabricating data.
 */
import type { AnalyticsSummary, BreakdownRow } from '@/features/analytics';
import { blockTitle } from './definitions';
import {
  SENSITIVE_BLOCKS,
  type BlockKind,
  type RenderedBlock,
  type RenderedReport,
  type ReportDefinition,
} from './types';

/** Pre-fetched, owner-scoped engine outputs the render engine reads from. */
export interface EngineBundle {
  analytics: AnalyticsSummary | null;
  sessionBreakdown?: BreakdownRow[];
  strategyBreakdown?: BreakdownRow[];
  symbolBreakdown?: BreakdownRow[];
  /** Opaque psychology overview (9.11) — only present when authorized. */
  psychology?: unknown;
  habits?: unknown;
  goals?: unknown;
  /** 9.12 AI insights (evidence + confidence carried through unchanged). */
  aiInsights?: unknown;
  ruleViolations?: unknown;
}

function resolveBlock(kind: BlockKind, bundle: EngineBundle, note?: string): unknown {
  const a = bundle.analytics;
  switch (kind) {
    case 'kpis':
      return a?.kpis ?? null;
    case 'equity_curve':
    case 'balance_curve':
      return a?.equityCurve ?? null;
    case 'drawdown':
      return a?.drawdown ?? null;
    case 'risk':
      return a?.risk ?? null;
    case 'trade_distribution':
      return bundle.symbolBreakdown ?? null;
    case 'session_performance':
      return bundle.sessionBreakdown ?? null;
    case 'strategy_performance':
      return bundle.strategyBreakdown ?? null;
    case 'calendar_heatmap':
      return a?.equityCurve ?? null; // heatmap derives from the same trade set
    case 'goal_progress':
      return bundle.goals ?? null;
    case 'habit_tracking':
      return bundle.habits ?? null;
    case 'psychology':
      return bundle.psychology ?? null;
    case 'ai_insights':
      return bundle.aiInsights ?? null;
    case 'rule_violations':
      return bundle.ruleViolations ?? null;
    case 'notes':
      return note ?? null;
    default:
      return null;
  }
}

export function renderReport(def: ReportDefinition, bundle: EngineBundle): RenderedReport {
  const blocks: RenderedBlock[] = def.blocks.map((kind) => ({
    kind,
    title: blockTitle(kind),
    sensitive: SENSITIVE_BLOCKS.has(kind),
    data: resolveBlock(kind, bundle, def.note),
  }));
  return {
    type: def.type,
    title: def.title,
    filters: def.filters,
    blocks,
    note: def.note,
    generatedAt: new Date().toISOString(),
  };
}
