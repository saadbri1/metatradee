/**
 * Shared-report projection — the ONLY payload a share link may expose. It is a
 * sanitized subset of a RenderedReport:
 *   - Psychology/habit blocks (SENSITIVE) are dropped UNLESS the owner explicitly
 *     opted in per-report AND the share is not public. Never in a public share.
 *   - Internal filter identifiers (account/broker/strategy ids) are stripped so a
 *     share never leaks account structure — only the date window is kept for
 *     context.
 *   - No raw account, no other reports, no attachment private URLs.
 * This function is the single chokepoint; over-fetching is impossible if callers
 * always send RenderedReport data through here before persisting/serving a share.
 */
import {
  SENSITIVE_BLOCKS,
  type RenderedBlock,
  type RenderedReport,
  type ShareConfig,
} from '../types';

export interface SharedReport {
  type: string;
  title: string;
  /** Only the date window survives projection (no account/broker/strategy ids). */
  dateRange: { from?: string; to?: string };
  blocks: RenderedBlock[];
  note?: string;
  generatedAt: string;
  /** Echo of the permissions the viewer is granted. */
  permissions: { allowDownload: boolean; isPublic: boolean };
}

export function projectSharedReport(report: RenderedReport, config: ShareConfig): SharedReport {
  const allowSensitive = config.includePsychology && !config.isPublic;

  const blocks = report.blocks.filter((b) => {
    if (SENSITIVE_BLOCKS.has(b.kind) || b.sensitive) return allowSensitive;
    return true;
  });

  return {
    type: report.type,
    title: report.title,
    dateRange: { from: report.filters.date_from, to: report.filters.date_to },
    blocks,
    note: report.note,
    generatedAt: report.generatedAt,
    permissions: { allowDownload: config.allowDownload, isPublic: config.isPublic },
  };
}
