/**
 * JSON export — a stable, documented schema (versioned) for programmatic use and
 * the future API-export seam. Numbers are the engines' own outputs, unchanged.
 * Notes are emitted as data (escaping happens only when rendered into markup).
 */
import type { RenderedReport } from '../types';

export const REPORT_JSON_SCHEMA_VERSION = '1.0.0';

export interface ReportJson {
  schemaVersion: string;
  type: string;
  title: string;
  generatedAt: string;
  filters: RenderedReport['filters'];
  blocks: { kind: string; title: string; sensitive: boolean; data: unknown }[];
  note?: string;
}

export function reportToJson(report: RenderedReport): ReportJson {
  return {
    schemaVersion: REPORT_JSON_SCHEMA_VERSION,
    type: report.type,
    title: report.title,
    generatedAt: report.generatedAt,
    filters: report.filters,
    blocks: report.blocks.map((b) => ({
      kind: b.kind,
      title: b.title,
      sensitive: b.sensitive,
      data: b.data,
    })),
    note: report.note,
  };
}

export function reportToJsonString(report: RenderedReport): string {
  return JSON.stringify(reportToJson(report), null, 2);
}
