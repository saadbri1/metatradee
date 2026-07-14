'use client';

/**
 * Public share viewer. Renders ONLY the sanitized snapshot returned by the
 * token-gated RPC — no app chrome, no account data, no psychology unless the
 * owner opted in (and never for public shares, enforced server-side). Handles
 * password-locked and expired/not-found states honestly.
 */
import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { FormAlert } from '@/features/auth/components/form-alert';
import { verifySharedReportAction } from '../server/actions';
import { ReportBlockView } from './report-block-view';
import type { RenderedBlock } from '../types';

interface SharedPayload {
  title: string;
  blocks: RenderedBlock[];
  generatedAt: string;
  permissions?: { allowDownload: boolean; isPublic: boolean };
}

export function SharedReportView({
  token,
  initial,
}: {
  token: string;
  initial: { locked?: boolean; payload?: unknown } | null;
}) {
  const [payload, setPayload] = useState<SharedPayload | null>(
    initial && !initial.locked ? (initial.payload as SharedPayload) : null,
  );
  const [locked, setLocked] = useState(!!initial?.locked);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!initial) {
    return (
      <div className="mx-auto max-w-md py-16">
        <FormAlert tone="error">This link is invalid, expired, or has been revoked.</FormAlert>
      </div>
    );
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const r = await verifySharedReportAction(token, password);
    setPending(false);
    if (r.ok && r.payload) {
      setPayload(r.payload as SharedPayload);
      setLocked(false);
    } else {
      setError('Incorrect password.');
    }
  }

  if (locked && !payload) {
    return (
      <div className="mx-auto max-w-sm py-16">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <Lock className="size-5 text-primary" aria-hidden />
              <h1 className="font-display text-lg font-semibold">Password required</h1>
            </div>
            <form className="space-y-3" onSubmit={submitPassword}>
              <Input
                type="password"
                aria-label="Share password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
              />
              {error ? <FormAlert tone="error">{error}</FormAlert> : null}
              <Button type="submit" disabled={pending || !password} className="w-full">
                View report
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!payload) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-10">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{payload.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Shared report · generated {new Date(payload.generatedAt).toLocaleDateString()}
        </p>
      </header>
      {payload.blocks.map((b) => (
        <ReportBlockView key={b.kind} block={b} />
      ))}
      <p className="text-xs text-muted-foreground">
        This is a view-only shared report. It contains only the data the owner chose to include.
      </p>
    </div>
  );
}
