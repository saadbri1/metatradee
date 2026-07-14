'use server';

/**
 * Reports server actions. Auth-first, owner-scoped (RLS + explicit user_id).
 * Every export + share lifecycle event is audited. Shares persist only a
 * SANITIZED projection (psychology excluded unless opted in, never public) so a
 * link can never over-fetch. Heavy formats (PDF/xlsx) are queued as export_jobs
 * (async plane); CSV/JSON are produced inline (small + safe).
 */
import { createClient } from '@/lib/supabase/server';
import { reportCreateSchema, shareCreateSchema, scheduleCreateSchema } from '../schemas';
import { generateRenderedReport } from './queries';
import { reportToCsv } from '../export/csv';
import { reportToJsonString } from '../export/json';
import { projectSharedReport } from '../share/projection';
import { generateShareToken, generateSalt, hashPassword } from '../share/tokens';
import { REPORT_BLOCKS, REPORT_TITLES } from '../definitions';
import type { ExportFormat, ReportDefinition, RenderedReport, ShareConfig } from '../types';

interface ActionResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}
const GENERIC = 'Something went wrong. Please try again.';

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { userId: user.id, supabase } : null;
}

async function audit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  reportId: string | null,
  eventType: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await supabase
    .from('report_events')
    .insert({ user_id: userId, report_id: reportId, event_type: eventType, metadata });
}

export async function createReportAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = reportCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please fix the errors below.' };
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const { data, error } = await c.supabase
    .from('reports')
    .insert({ user_id: c.userId, ...parsed.data })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: GENERIC };
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function deleteReportAction(id: string): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const { error } = await c.supabase
    .from('reports')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', c.userId);
  return error ? { ok: false, error: GENERIC } : { ok: true };
}

/** Build a report definition from a saved report row (or an ad-hoc type). */
function definitionFromRow(row: {
  type: ReportDefinition['type'];
  title: string;
  blocks: string[];
  filters: ReportDefinition['filters'];
  note: string | null;
}): ReportDefinition {
  return {
    type: row.type,
    title: row.title,
    blocks: (row.blocks.length
      ? row.blocks
      : REPORT_BLOCKS[row.type]) as ReportDefinition['blocks'],
    filters: row.filters ?? {},
    note: row.note ?? undefined,
  };
}

/** Generate (render) a saved report on demand. Owner-scoped. */
export async function generateReportAction(
  reportId: string,
): Promise<ActionResult<RenderedReport>> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const { data: row } = await c.supabase
    .from('reports')
    .select('type, title, blocks, filters, note')
    .eq('id', reportId)
    .eq('user_id', c.userId)
    .is('deleted_at', null)
    .single();
  if (!row) return { ok: false, error: 'Report not found.' };
  const rendered = await generateRenderedReport(
    c.supabase,
    c.userId,
    definitionFromRow(row as never),
  );
  return { ok: true, data: rendered };
}

/** Inline export for small/safe formats (CSV/JSON). Heavy formats → queueExport. */
export async function exportReportAction(
  reportId: string,
  format: ExportFormat,
): Promise<ActionResult<{ filename: string; mime: string; content: string }>> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const gen = await generateReportAction(reportId);
  if (!gen.ok || !gen.data) return { ok: false, error: gen.error ?? GENERIC };
  const report = gen.data;

  let payload: { filename: string; mime: string; content: string };
  if (format === 'csv') {
    payload = { filename: 'report.csv', mime: 'text/csv', content: reportToCsv(report) };
  } else if (format === 'json') {
    payload = {
      filename: 'report.json',
      mime: 'application/json',
      content: reportToJsonString(report),
    };
  } else {
    // PDF / xlsx / print are heavy → queued for the async worker (pending-live).
    await c.supabase
      .from('export_jobs')
      .insert({ user_id: c.userId, report_id: reportId, format, status: 'queued' });
    await audit(c.supabase, c.userId, reportId, 'export_generated', { format, mode: 'queued' });
    return {
      ok: false,
      error: 'This format is generated in the background — check exports shortly.',
    };
  }
  await audit(c.supabase, c.userId, reportId, 'export_generated', { format });
  return { ok: true, data: payload };
}

/** Create a private-by-default share carrying only a sanitized snapshot. */
export async function createShareAction(input: unknown): Promise<ActionResult<{ token: string }>> {
  const parsed = shareCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid share settings.' };
  }
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const v = parsed.data;

  const gen = await generateReportAction(v.reportId);
  if (!gen.ok || !gen.data) return { ok: false, error: gen.error ?? GENERIC };

  const config: ShareConfig = {
    allowDownload: v.allowDownload,
    isPublic: v.isPublic,
    includePsychology: v.includePsychology,
    expiresAt: v.expiresAt ?? null,
    hasPassword: !!v.password,
  };
  // Sanitized projection — the ONLY data the link will ever expose.
  const payload = projectSharedReport(gen.data, config);

  const token = generateShareToken();
  const salt = v.password ? generateSalt() : null;
  const passwordHash = v.password && salt ? hashPassword(v.password, salt) : null;

  const { error } = await c.supabase.from('report_shares').insert({
    user_id: c.userId,
    report_id: v.reportId,
    token,
    payload,
    allow_download: v.allowDownload,
    is_public: v.isPublic,
    include_psychology: v.includePsychology,
    password_salt: salt,
    password_hash: passwordHash,
    expires_at: v.expiresAt ?? null,
  });
  if (error) return { ok: false, error: GENERIC };
  await audit(c.supabase, c.userId, v.reportId, 'share_created', {
    isPublic: v.isPublic,
    hasPassword: !!v.password,
    includePsychology: v.includePsychology,
  });
  return { ok: true, data: { token } };
}

export async function revokeShareAction(shareId: string): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const { data, error } = await c.supabase
    .from('report_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', shareId)
    .eq('user_id', c.userId)
    .select('report_id')
    .single();
  if (error) return { ok: false, error: GENERIC };
  await audit(
    c.supabase,
    c.userId,
    (data as { report_id: string } | null)?.report_id ?? null,
    'share_revoked',
  );
  return { ok: true };
}

export async function createScheduleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = scheduleCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid schedule.' };
  const c = await ctx();
  if (!c) return { ok: false, error: 'You must be signed in.' };
  const { data, error } = await c.supabase
    .from('report_schedules')
    .insert({ user_id: c.userId, ...parsed.data })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: GENERIC };
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export interface ReportListItem {
  id: string;
  type: ReportDefinition['type'];
  title: string;
  is_favorite: boolean;
  is_archived: boolean;
  updated_at: string;
}

export async function listReportsAction(): Promise<ReportListItem[]> {
  const c = await ctx();
  if (!c) return [];
  const { data } = await c.supabase
    .from('reports')
    .select('id, type, title, is_favorite, is_archived, updated_at')
    .eq('user_id', c.userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  return (data as ReportListItem[] | null) ?? [];
}

/**
 * PUBLIC (unauthenticated) share fetch. Goes through the SECURITY DEFINER RPC so
 * a viewer never touches the RLS-protected raw tables — only the pre-sanitized
 * snapshot. Returns { locked } for password shares (call verify), the payload, or
 * null when missing/expired/revoked. Best-effort access audit is owner-scoped, so
 * it is recorded via the RPC path server-side, not here.
 */
export async function getSharedReportAction(
  token: string,
): Promise<{ locked?: boolean; allowDownload?: boolean; payload?: unknown } | null> {
  if (!token || token.length < 20) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('report_share_fetch', { p_token: token });
  if (error || data === null || data === undefined) return null;
  const obj = data as Record<string, unknown>;
  if (obj.locked === true) return { locked: true, allowDownload: obj.allowDownload === true };
  return { payload: data };
}

export async function verifySharedReportAction(
  token: string,
  password: string,
): Promise<{ ok: boolean; payload?: unknown }> {
  if (!token || !password) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('report_share_verify', {
    p_token: token,
    p_password: password,
  });
  if (error || data === null || data === undefined) return { ok: false };
  const obj = data as Record<string, unknown>;
  if (obj.locked === true) return { ok: false };
  return { ok: true, payload: data };
}

/** Preset report types available in the builder (title + default blocks). */
export async function getReportPresets(): Promise<
  { type: ReportDefinition['type']; title: string; blocks: string[] }[]
> {
  return (Object.keys(REPORT_TITLES) as ReportDefinition['type'][]).map((type) => ({
    type,
    title: REPORT_TITLES[type],
    blocks: REPORT_BLOCKS[type],
  }));
}
