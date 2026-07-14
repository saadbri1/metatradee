/**
 * Report-type presets. ONE rendering engine, many definitions: each report type
 * is just a chosen set of blocks + a scope. No report type owns any data logic —
 * blocks pull from their owning engine (9.8–9.12) at render time.
 */
import type { BlockKind, ReportType } from './types';

const CORE: BlockKind[] = ['kpis', 'equity_curve', 'drawdown', 'risk'];

/** Default block composition per report type. Users can customize in the builder. */
export const REPORT_BLOCKS: Record<ReportType, BlockKind[]> = {
  daily: ['kpis', 'session_performance', 'trade_distribution', 'notes'],
  weekly: [...CORE, 'session_performance', 'strategy_performance', 'ai_insights'],
  monthly: [
    ...CORE,
    'session_performance',
    'strategy_performance',
    'calendar_heatmap',
    'ai_insights',
  ],
  quarterly: [...CORE, 'strategy_performance', 'goal_progress', 'ai_insights'],
  yearly: [...CORE, 'strategy_performance', 'calendar_heatmap', 'goal_progress', 'ai_insights'],
  custom: [...CORE],
  strategy: ['kpis', 'strategy_performance', 'rule_violations', 'risk'],
  broker: ['kpis', 'trade_distribution', 'risk'],
  account: [...CORE, 'trade_distribution'],
  session: ['kpis', 'session_performance', 'calendar_heatmap'],
  symbol: ['kpis', 'trade_distribution', 'risk'],
  risk: ['kpis', 'risk', 'drawdown', 'trade_distribution'],
  psychology: ['psychology', 'habit_tracking', 'goal_progress'],
  goal_progress: ['goal_progress', 'habit_tracking'],
  ai_performance: ['kpis', 'ai_insights', 'strategy_performance'],
  executive: ['kpis', 'equity_curve', 'strategy_performance', 'goal_progress', 'ai_insights'],
};

export const REPORT_TITLES: Record<ReportType, string> = {
  daily: 'Daily Report',
  weekly: 'Weekly Report',
  monthly: 'Monthly Report',
  quarterly: 'Quarterly Report',
  yearly: 'Yearly Report',
  custom: 'Custom Report',
  strategy: 'Strategy Report',
  broker: 'Broker Report',
  account: 'Account Report',
  session: 'Session Report',
  symbol: 'Symbol Report',
  risk: 'Risk Report',
  psychology: 'Psychology Report',
  goal_progress: 'Goal Progress Report',
  ai_performance: 'AI Performance Report',
  executive: 'Executive Summary',
};

const BLOCK_TITLES: Record<BlockKind, string> = {
  kpis: 'Performance KPIs',
  equity_curve: 'Equity Curve',
  balance_curve: 'Balance Curve',
  drawdown: 'Drawdown',
  risk: 'Risk Metrics',
  trade_distribution: 'Trade Distribution',
  session_performance: 'Session Performance',
  calendar_heatmap: 'Calendar Heatmap',
  strategy_performance: 'Strategy Performance',
  goal_progress: 'Goal Progress',
  habit_tracking: 'Habit Tracking',
  psychology: 'Psychology',
  ai_insights: 'AI Insights',
  rule_violations: 'Rule Violations',
  notes: 'Notes',
};

export function blockTitle(kind: BlockKind): string {
  return BLOCK_TITLES[kind];
}
