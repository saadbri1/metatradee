/**
 * CSV export. Every cell goes through `csvField` → formula-injection neutralized
 * + RFC-4180 quoted. Tabular blocks (KPIs, breakdowns) are emitted as labelled
 * sections; non-tabular blocks are summarized as a single row so the file stays
 * valid and lossless-enough without inventing structure.
 */
import type { Kpis, BreakdownRow } from '@/features/analytics';
import { csvField } from '../sanitize';
import type { RenderedReport } from '../types';

/** Build a CSV table from headers + rows (all cells neutralized). */
export function rowsToCsv(headers: string[], rows: (string | number | null)[][]): string {
  const head = headers.map(csvField).join(',');
  const body = rows.map((r) => r.map(csvField).join(',')).join('\n');
  return body ? `${head}\n${body}` : head;
}

function kpisSection(kpis: Kpis): string {
  const rows: [string, number | null][] = [
    ['Total trades', kpis.totalTrades],
    ['Wins', kpis.wins],
    ['Losses', kpis.losses],
    ['Win rate %', kpis.winRate === null ? null : Math.round(kpis.winRate * 100)],
    ['Net P&L', kpis.netProfit],
    ['Profit factor', kpis.profitFactor],
    ['Expectancy', kpis.expectancy],
    ['Avg R:R', kpis.avgRr],
    ['Max consecutive losses', kpis.maxConsecutiveLosses],
  ];
  return rowsToCsv(['Metric', 'Value'], rows);
}

function breakdownSection(rows: BreakdownRow[]): string {
  return rowsToCsv(
    ['Group', 'Trades', 'Win rate %', 'Net P&L'],
    rows.map((r) => [
      r.label,
      r.kpis.totalTrades,
      r.kpis.winRate === null ? null : Math.round(r.kpis.winRate * 100),
      r.kpis.netProfit,
    ]),
  );
}

/** Serialize a rendered report to a multi-section CSV string. */
export function reportToCsv(report: RenderedReport): string {
  const sections: string[] = [`# ${report.title}`];
  for (const block of report.blocks) {
    sections.push(`\n## ${block.title}`);
    if (block.kind === 'kpis' && block.data) {
      sections.push(kpisSection(block.data as Kpis));
    } else if (
      (block.kind === 'session_performance' ||
        block.kind === 'strategy_performance' ||
        block.kind === 'trade_distribution') &&
      Array.isArray(block.data)
    ) {
      sections.push(breakdownSection(block.data as BreakdownRow[]));
    } else if (block.kind === 'notes' && block.data) {
      sections.push(rowsToCsv(['Note'], [[String(block.data)]]));
    } else {
      sections.push(rowsToCsv(['Info'], [['See on-screen report / JSON export']]));
    }
  }
  return sections.join('\n');
}
