'use client';

import { useState } from 'react';
import { Download, FileText, Plus, Share2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormAlert } from '@/features/auth/components/form-alert';
import { REPORT_TITLES } from '../definitions';
import {
  useReports,
  useCreateReport,
  useDeleteReport,
  useGenerateReport,
  useExportReport,
  useCreateShare,
} from '../hooks';
import { ReportBlockView } from './report-block-view';
import type { ExportFormat, ReportType } from '../types';

const TYPES = Object.keys(REPORT_TITLES) as ReportType[];

function download(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsCenter() {
  const reports = useReports();
  const createReport = useCreateReport();
  const deleteReport = useDeleteReport();
  const exportReport = useExportReport();
  const createShare = useCreateShare();

  const [type, setType] = useState<ReportType>('monthly');
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const render = useGenerateReport(selected ?? '', !!selected);
  const rendered = render.data?.ok ? render.data.data : null;

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    createReport.mutate(
      { type, title: title || REPORT_TITLES[type], blocks: [], filters: {} },
      { onSuccess: (r) => r.ok && r.data && (setSelected(r.data.id), setTitle('')) },
    );
  }

  function onExport(format: ExportFormat) {
    if (!selected) return;
    exportReport.mutate(
      { reportId: selected, format },
      {
        onSuccess: (r) => {
          if (r.ok && r.data) download(r.data.filename, r.data.mime, r.data.content);
        },
      },
    );
  }

  function onShare() {
    if (!selected) return;
    setShareUrl(null);
    createShare.mutate(
      { reportId: selected, allowDownload: false, isPublic: false, includePsychology: false },
      {
        onSuccess: (r) => {
          if (r.ok && r.data) {
            setShareUrl(`${window.location.origin}/share/report/${r.data.token}`);
          }
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Professional reports composed from your analytics — figures match the app exactly. Private
          by default; you choose what any share exposes.
        </p>
      </div>

      {/* Create from a preset. */}
      <form className="flex flex-wrap items-end gap-2" onSubmit={onCreate}>
        <div className="grid gap-1">
          <label htmlFor="report-type" className="text-xs text-muted-foreground">
            Report type
          </label>
          <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
            <SelectTrigger id="report-type" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {REPORT_TITLES[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          aria-label="Report title"
          placeholder={REPORT_TITLES[type]}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="max-w-xs"
        />
        <Button type="submit" disabled={createReport.isPending}>
          <Plus aria-hidden /> Create report
        </Button>
      </form>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        {/* Saved reports. */}
        <section className="space-y-2" aria-label="Saved reports">
          <h2 className="font-display text-lg font-semibold tracking-tight">Saved</h2>
          {reports.data && reports.data.length > 0 ? (
            <ul className="space-y-1">
              {reports.data.map((r) => (
                <li key={r.id}>
                  <div
                    className={`flex items-center justify-between gap-2 rounded-lg border p-2 ${
                      selected === r.id ? 'border-primary' : 'border-border'
                    }`}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                      onClick={() => {
                        setSelected(r.id);
                        setShareUrl(null);
                      }}
                    >
                      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate">{r.title}</span>
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${r.title}`}
                      onClick={() => deleteReport.mutate(r.id)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No reports yet — create one above.</p>
          )}
        </section>

        {/* Rendered report. */}
        <section className="space-y-4" aria-label="Report preview">
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              Select or create a report to preview it.
            </p>
          ) : render.isLoading ? (
            <p className="text-sm text-muted-foreground" role="status">
              Generating report…
            </p>
          ) : rendered ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{REPORT_TITLES[rendered.type]}</Badge>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => onExport('csv')}>
                    <Download aria-hidden /> CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onExport('json')}>
                    <Download aria-hidden /> JSON
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onExport('pdf')}>
                    <Download aria-hidden /> PDF
                  </Button>
                  <Button size="sm" onClick={onShare} disabled={createShare.isPending}>
                    <Share2 aria-hidden /> Share
                  </Button>
                </div>
              </div>

              {exportReport.data && !exportReport.data.ok ? (
                <FormAlert tone="success">{exportReport.data.error}</FormAlert>
              ) : null}

              {shareUrl ? (
                <FormAlert tone="success">
                  Private link created (view-only, no psychology data):{' '}
                  <span className="break-all font-mono text-xs">{shareUrl}</span>
                </FormAlert>
              ) : null}

              {rendered.blocks.map((b) => (
                <ReportBlockView key={b.kind} block={b} />
              ))}
            </>
          ) : (
            <FormAlert tone="error">
              {render.data && !render.data.ok ? render.data.error : 'Could not generate report.'}
            </FormAlert>
          )}
        </section>
      </div>
    </div>
  );
}
