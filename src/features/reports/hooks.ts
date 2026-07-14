'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listReportsAction,
  createReportAction,
  deleteReportAction,
  generateReportAction,
  exportReportAction,
  createShareAction,
  revokeShareAction,
  createScheduleAction,
  type ReportListItem,
} from './server/actions';
import type { ReportCreateInput, ShareCreateInput, ScheduleCreateInput } from './schemas';
import type { ExportFormat, RenderedReport } from './types';

interface ActionResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function useReports() {
  return useQuery<ReportListItem[]>({
    queryKey: ['reports', 'list'],
    queryFn: () => listReportsAction(),
    staleTime: 30_000,
  });
}

export function useGenerateReport(reportId: string, enabled = false) {
  return useQuery<ActionResult<RenderedReport>>({
    queryKey: ['reports', 'render', reportId],
    queryFn: () => generateReportAction(reportId),
    enabled: enabled && !!reportId,
    staleTime: 60_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['reports'] });
}

export function useCreateReport() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult<{ id: string }>, Error, ReportCreateInput>({
    mutationFn: (input) => createReportAction(input),
    onSuccess: (r) => r.ok && invalidate(),
  });
}

export function useDeleteReport() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult, Error, string>({
    mutationFn: (id) => deleteReportAction(id),
    onSuccess: (r) => r.ok && invalidate(),
  });
}

export function useExportReport() {
  return useMutation<
    ActionResult<{ filename: string; mime: string; content: string }>,
    Error,
    { reportId: string; format: ExportFormat }
  >({
    mutationFn: ({ reportId, format }) => exportReportAction(reportId, format),
  });
}

export function useCreateShare() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult<{ token: string }>, Error, ShareCreateInput>({
    mutationFn: (input) => createShareAction(input),
    onSuccess: (r) => r.ok && invalidate(),
  });
}

export function useRevokeShare() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult, Error, string>({
    mutationFn: (id) => revokeShareAction(id),
    onSuccess: (r) => r.ok && invalidate(),
  });
}

export function useCreateSchedule() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult<{ id: string }>, Error, ScheduleCreateInput>({
    mutationFn: (input) => createScheduleAction(input),
    onSuccess: (r) => r.ok && invalidate(),
  });
}
