'use client';

/**
 * Import wizard (Phase 10.8): upload → adapter+mapping → dry-run preview →
 * confirm → chunked progress → summary. The preview writes NOTHING; commits go
 * through idempotent server batches (safe to retry). Duplicates/invalid rows
 * are always shown — nothing is silently merged or dropped. Accessible:
 * keyboard-operable steps, polite progress announcements, honest errors.
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, FileUp, RotateCcw, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormAlert } from '@/features/auth/components/form-alert';
import { parseCsv, parseJsonRows } from '../parse';
import { ADAPTERS, autoDetectMapping, type MappableField } from '../adapters';
import { chunk, type ImportPreview } from '../pipeline';
import {
  previewImportAction,
  startImportAction,
  commitImportBatchAction,
  finishImportAction,
  cancelImportAction,
  rollbackImportAction,
  listImportsAction,
  type ImportListItem,
} from '../server/actions';
import { useQuery, useQueryClient } from '@tanstack/react-query';

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB — clear cap, no silent truncation
const FIELDS: MappableField[] = [
  'symbol',
  'direction',
  'entry_price',
  'exit_price',
  'quantity',
  'opened_at',
  'closed_at',
  'commission',
  'swap',
  'fees',
  'notes',
];

export function ImportWizard() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [error, setError] = useState<string | null>(null);
  const [adapterId, setAdapterId] = useState('generic');
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Partial<Record<MappableField, number>>>({});
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [progress, setProgress] = useState({
    done: 0,
    total: 0,
    imported: 0,
    duplicate: 0,
    failed: 0,
  });
  const [importId, setImportId] = useState<string | null>(null);
  const cancelled = useRef(false);

  const history = useQuery<ImportListItem[]>({
    queryKey: ['imports', 'list'],
    queryFn: () => listImportsAction(),
    staleTime: 15_000,
  });

  async function onFile(file: File) {
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError('File is larger than 20 MB — split it and import in parts.');
      return;
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.json') && !lower.endsWith('.txt')) {
      setError(
        lower.endsWith('.xlsx')
          ? 'XLSX is not supported yet — export as CSV from your platform and import that.'
          : 'Unsupported file type. Use CSV or JSON.',
      );
      return;
    }
    const text = await file.text();
    let hdrs: string[];
    let dataRows: string[][];
    if (lower.endsWith('.json')) {
      const parsed = parseJsonRows(text);
      if (!parsed) {
        setError('Could not parse JSON — expected an array of trade objects.');
        return;
      }
      hdrs = parsed.headers;
      dataRows = parsed.rows;
    } else {
      const all = parseCsv(text);
      if (all.length < 2) {
        setError('The file needs a header row and at least one trade row.');
        return;
      }
      hdrs = all[0]!;
      dataRows = all.slice(1);
    }
    setFileName(file.name);
    setHeaders(hdrs);
    setRows(dataRows);
    const adapter = ADAPTERS.find((a) => a.id === adapterId) ?? ADAPTERS[0]!;
    setMapping(autoDetectMapping(hdrs, adapter));
    setStep('mapping');
  }

  async function runPreview() {
    setError(null);
    const r = await previewImportAction({ adapterId, mapping, rows, accountId: null });
    if (!r.ok || !r.data) {
      setError(r.error ?? 'Preview failed.');
      return;
    }
    setPreview(r.data);
    setStep('preview');
  }

  async function runImport() {
    if (!preview) return;
    setError(null);
    cancelled.current = false;
    const start = await startImportAction({ adapterId, fileName, totalRows: preview.counts.total });
    if (!start.ok || !start.data) {
      setError(start.error ?? 'Could not start the import.');
      return;
    }
    const id = start.data.importId;
    setImportId(id);
    setStep('importing');

    const toImport = preview.valid.concat(preview.partials); // partials shown; user confirmed
    const batches = chunk(
      toImport.map((p) => ({ rowIndex: p.rowIndex, input: p.input })),
      200,
    );
    const totals = { done: 0, total: toImport.length, imported: 0, duplicate: 0, failed: 0 };
    for (const batch of batches) {
      if (cancelled.current) {
        await cancelImportAction(id);
        break;
      }
      const res = await commitImportBatchAction({ importId: id, rows: batch });
      if (!res.ok || !res.data) {
        setError(res.error ?? 'A batch failed — the import is resumable; retry to continue.');
        break;
      }
      totals.done += batch.length;
      totals.imported += res.data.imported;
      totals.duplicate += res.data.duplicate;
      totals.failed += res.data.failed;
      setProgress({ ...totals });
      if (res.data.capReached) {
        setError('Your plan trade limit was reached — remaining rows were not imported.');
        break;
      }
    }
    if (!cancelled.current) await finishImportAction(id);
    qc.invalidateQueries({ queryKey: ['imports'] });
    qc.invalidateQueries({ queryKey: ['trades'] });
    qc.invalidateQueries({ queryKey: ['analytics'] });
    setStep('done');
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Import trades</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bring history from your platform. Nothing is written until you confirm the preview, and
          re-importing the same file never creates duplicates.
        </p>
      </div>

      {error ? <FormAlert tone="error">{error}</FormAlert> : null}

      {step === 'upload' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1 · Choose platform &amp; file</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid max-w-xs gap-1">
              <label htmlFor="adapter" className="text-xs text-muted-foreground">
                Platform
              </label>
              <Select value={adapterId} onValueChange={setAdapterId}>
                <SelectTrigger id="adapter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADAPTERS.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json,.txt"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
            <Button onClick={() => fileRef.current?.click()}>
              <FileUp aria-hidden /> Choose CSV or JSON file
            </Button>
            <p className="text-xs text-muted-foreground">
              CSV or JSON, up to 20 MB. XLSX: export as CSV first (native XLSX is on the roadmap).
            </p>
          </CardContent>
        </Card>
      ) : null}

      {step === 'mapping' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2 · Map columns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Auto-detected from {fileName}. Adjust any field — Symbol and Direction are required.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {FIELDS.map((f) => (
                <div key={f} className="grid gap-1">
                  <label htmlFor={`map-${f}`} className="text-xs capitalize text-muted-foreground">
                    {f.replace(/_/g, ' ')}
                  </label>
                  <Select
                    value={mapping[f] === undefined ? 'none' : String(mapping[f])}
                    onValueChange={(v) =>
                      setMapping((m) => ({ ...m, [f]: v === 'none' ? undefined : Number(v) }))
                    }
                  >
                    <SelectTrigger id={`map-${f}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— not mapped —</SelectItem>
                      {headers.map((h, i) => (
                        <SelectItem key={`${h}-${i}`} value={String(i)}>
                          {h || `Column ${i + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={runPreview}
                disabled={mapping.symbol === undefined || mapping.direction === undefined}
              >
                Preview (dry run)
              </Button>
              <Button variant="ghost" onClick={() => setStep('upload')}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 'preview' && preview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3 · Preview — nothing written yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2" role="status">
              <Badge>{preview.counts.valid} ready</Badge>
              <Badge variant="secondary">{preview.counts.duplicate} duplicates (skipped)</Badge>
              <Badge variant="secondary">{preview.counts.partial} possible duplicates</Badge>
              <Badge variant="outline">{preview.counts.invalid} invalid</Badge>
            </div>
            {preview.counts.partial > 0 ? (
              <p className="text-xs text-muted-foreground">
                Possible duplicates match an existing trade&apos;s account/symbol/direction/time but
                differ in size or price. They WILL be imported — review them in the journal after.
              </p>
            ) : null}
            {preview.invalid.length > 0 ? (
              <div className="max-h-40 overflow-y-auto rounded-md border border-border p-2 text-xs">
                {preview.invalid.slice(0, 50).map((r) => (
                  <p key={r.rowIndex}>
                    Row {r.rowIndex + 2}: {r.errors.join('; ')}
                  </p>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button
                onClick={runImport}
                disabled={preview.counts.valid + preview.counts.partial === 0}
              >
                Import {preview.counts.valid + preview.counts.partial} trades
              </Button>
              <Button variant="ghost" onClick={() => setStep('mapping')}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 'importing' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Importing…</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-sm" role="status" aria-live="polite">
              {progress.done} of {progress.total} rows · {progress.imported} imported ·{' '}
              {progress.duplicate} duplicates · {progress.failed} failed
            </p>
            <Button variant="outline" onClick={() => (cancelled.current = true)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step === 'done' ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-profit" aria-hidden /> Import finished
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              {progress.imported} imported · {progress.duplicate} duplicates skipped ·{' '}
              {progress.failed} failed. Failed rows stay retryable in the import log.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/journal">Open journal</Link>
              </Button>
              {importId ? (
                <Button
                  variant="outline"
                  onClick={async () => {
                    await rollbackImportAction(importId);
                    qc.invalidateQueries({ queryKey: ['trades'] });
                    qc.invalidateQueries({ queryKey: ['imports'] });
                  }}
                >
                  <Undo2 aria-hidden /> Undo this import
                </Button>
              ) : null}
              <Button
                variant="ghost"
                onClick={() => {
                  setStep('upload');
                  setPreview(null);
                  setProgress({ done: 0, total: 0, imported: 0, duplicate: 0, failed: 0 });
                }}
              >
                <RotateCcw aria-hidden /> Import another file
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Import history */}
      <section className="space-y-2" aria-label="Import history">
        <h2 className="font-display text-lg font-semibold tracking-tight">Import history</h2>
        {history.data && history.data.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Previous imports</caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-3 py-2">
                    File
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Platform
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Imported
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Duplicates
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Failed
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.data.map((im) => (
                  <tr key={im.id} className="border-t border-border">
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {im.file_name ?? '—'}
                    </th>
                    <td className="px-3 py-2">{im.adapter}</td>
                    <td className="px-3 py-2">{im.status}</td>
                    <td className="tabular px-3 py-2 text-right">{im.imported_rows}</td>
                    <td className="tabular px-3 py-2 text-right">{im.duplicate_rows}</td>
                    <td className="tabular px-3 py-2 text-right">{im.failed_rows}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {new Date(im.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No imports yet.</p>
        )}
      </section>
    </div>
  );
}
