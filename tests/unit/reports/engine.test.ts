import { describe, it, expect } from 'vitest';
import { computeKpis, computeAnalyticsSummary, computeBreakdown } from '@/features/analytics';
import { neutralizeCell, csvField, escapeHtml } from '@/features/reports/sanitize';
import { renderReport, type EngineBundle } from '@/features/reports/render';
import { reportToCsv } from '@/features/reports/export/csv';
import { reportToJson, REPORT_JSON_SCHEMA_VERSION } from '@/features/reports/export/json';
import { computeInsights } from '@/features/reports/insights';
import { REPORT_BLOCKS, REPORT_TITLES } from '@/features/reports/definitions';
import type { Kpis, BreakdownRow } from '@/features/analytics';
import type { ReportDefinition } from '@/features/reports/types';
import { trade } from '../ai-coach/fixtures';

function bundleFor(
  trades = [trade({ net_pnl: 100 }), trade({ net_pnl: -40 }), trade({ net_pnl: 60 })],
) {
  const bundle: EngineBundle = {
    analytics: computeAnalyticsSummary(trades),
    sessionBreakdown: computeBreakdown(trades, 'session'),
    strategyBreakdown: computeBreakdown(trades, 'strategy'),
    symbolBreakdown: computeBreakdown(trades, 'symbol'),
  };
  return { trades, bundle, kpis: computeKpis(trades) };
}

describe('CSV/Excel formula-injection neutralization (security-critical)', () => {
  it('prefixes a quote on cells starting with = + - @ and control chars', () => {
    expect(neutralizeCell('=1+1')).toBe("'=1+1");
    expect(neutralizeCell('+cmd')).toBe("'+cmd");
    expect(neutralizeCell('-2')).toBe("'-2");
    expect(neutralizeCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(neutralizeCell('\t=evil')).toBe("'\t=evil");
    expect(neutralizeCell('safe')).toBe('safe');
  });

  it('csvField quotes fields with commas/quotes/newlines after neutralizing', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
  });
});

describe('HTML/XSS escaping for PDF/HTML output', () => {
  it('escapes angle brackets and quotes in user notes', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escapeHtml(`" onload="x`)).toContain('&quot;');
  });
});

describe('report render reconciles with engines (no recompute)', () => {
  it('copies KPI figures verbatim from computeKpis', () => {
    const { bundle, kpis } = bundleFor();
    const def: ReportDefinition = {
      type: 'monthly',
      title: 'Monthly',
      blocks: ['kpis', 'session_performance'],
      filters: {},
    };
    const report = renderReport(def, bundle);
    const kpiBlock = report.blocks.find((b) => b.kind === 'kpis');
    expect((kpiBlock?.data as Kpis).netProfit).toBe(kpis.netProfit);
    expect((kpiBlock?.data as Kpis).netProfit).toBe(120); // 100 - 40 + 60
    expect((kpiBlock?.data as Kpis).totalTrades).toBe(kpis.totalTrades);
  });

  it('marks psychology/habit blocks as sensitive', () => {
    const def: ReportDefinition = {
      type: 'psychology',
      title: 'Psych',
      blocks: ['psychology', 'habit_tracking', 'kpis'],
      filters: {},
    };
    const report = renderReport(def, bundleFor().bundle);
    expect(report.blocks.find((b) => b.kind === 'psychology')?.sensitive).toBe(true);
    expect(report.blocks.find((b) => b.kind === 'habit_tracking')?.sensitive).toBe(true);
    expect(report.blocks.find((b) => b.kind === 'kpis')?.sensitive).toBe(false);
  });
});

describe('exports', () => {
  it('CSV contains the reconciled net P&L and is formula-safe', () => {
    const { bundle } = bundleFor();
    const def: ReportDefinition = { type: 'monthly', title: 'M', blocks: ['kpis'], filters: {} };
    const csv = reportToCsv(renderReport(def, bundle));
    expect(csv).toContain('Net P&L,120');
    // No unescaped formula-leading cell.
    expect(csv.split('\n').some((l) => /^[=+@]/.test(l))).toBe(false);
  });

  it('JSON export is a stable, versioned schema', () => {
    const { bundle } = bundleFor();
    const def: ReportDefinition = { type: 'custom', title: 'C', blocks: ['kpis'], filters: {} };
    const json = reportToJson(renderReport(def, bundle));
    expect(json.schemaVersion).toBe(REPORT_JSON_SCHEMA_VERSION);
    expect(json.blocks[0]?.kind).toBe('kpis');
  });
});

describe('insights center (deterministic, engine-sourced)', () => {
  it('surfaces a highlight with the reconciled net figure', () => {
    const { bundle, kpis } = bundleFor();
    const insights = computeInsights({
      analytics: bundle.analytics,
      sessionBreakdown: bundle.sessionBreakdown,
      symbolBreakdown: bundle.symbolBreakdown,
    });
    const highlight = insights.find((i) => i.kind === 'highlight');
    expect(highlight?.value).toBe(kpis.netProfit);
  });

  it('returns nothing when there is no analytics data', () => {
    expect(computeInsights({ analytics: null })).toEqual([]);
  });
});

describe('report definitions', () => {
  it('every report type has a title and at least one block', () => {
    for (const type of Object.keys(REPORT_TITLES) as (keyof typeof REPORT_TITLES)[]) {
      expect(REPORT_TITLES[type]).toBeTruthy();
      expect(REPORT_BLOCKS[type].length).toBeGreaterThan(0);
    }
  });
});
