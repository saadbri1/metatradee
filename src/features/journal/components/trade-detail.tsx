'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive, Copy, Pencil, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FormAlert } from '@/features/auth/components/form-alert';
import {
  useDeleteTrade,
  useRestoreTrade,
  useArchiveTrade,
  useDuplicateTrade,
  useSetTradeFlag,
} from '../hooks';
import { TradeReviewPanel } from '@/features/ai-coach/components/trade-review-panel';
import type { TradeRow } from '../types';
import { Money, Rr } from './pnl';

type DetailTrade = TradeRow & { private_notes: string | null; tag_ids: string[] };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular font-medium">{children}</dd>
    </div>
  );
}

export function TradeDetail({ trade }: { trade: DetailTrade }) {
  const router = useRouter();
  const del = useDeleteTrade();
  const restore = useRestoreTrade();
  const archive = useArchiveTrade();
  const duplicate = useDuplicateTrade();
  const flag = useSetTradeFlag();
  const [deleted, setDeleted] = useState(false);
  const [fav, setFav] = useState(trade.is_favorite);

  if (deleted) {
    return (
      <div className="space-y-4">
        <FormAlert tone="success">Trade deleted.</FormAlert>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => restore.mutate(trade.id, { onSuccess: () => setDeleted(false) })}
            disabled={restore.isPending}
          >
            Undo
          </Button>
          <Button variant="ghost" onClick={() => router.push('/journal')}>
            Back to journal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{trade.symbol}</h1>
          <Badge variant={trade.direction === 'buy' ? 'default' : 'secondary'}>
            {trade.direction === 'buy' ? 'Long' : 'Short'}
          </Badge>
          {trade.status === 'draft' ? <Badge variant="outline">Draft</Badge> : null}
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={fav ? 'Unfavorite' : 'Favorite'}
            aria-pressed={fav}
            onClick={() => {
              const next = !fav;
              setFav(next);
              flag.mutate(
                { id: trade.id, flag: 'is_favorite', value: next },
                { onError: () => setFav(!next) },
              );
            }}
          >
            <Star className={fav ? 'fill-warning text-warning' : ''} aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Edit" asChild>
            <Link href={`/journal/${trade.id}/edit`}>
              <Pencil aria-hidden />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Duplicate"
            onClick={() =>
              duplicate.mutate(trade.id, {
                onSuccess: (r) => r.ok && r.id && router.push(`/journal/${r.id}/edit`),
              })
            }
          >
            <Copy aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Archive"
            onClick={() => archive.mutate({ id: trade.id, archived: true })}
          >
            <Archive aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete"
            onClick={() => del.mutate(trade.id, { onSuccess: () => setDeleted(true) })}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-4">
        <Field label="Net P&L">
          <Money value={trade.net_pnl} currency={trade.currency} colored />
        </Field>
        <Field label="Gross P&L">
          <Money value={trade.pnl} currency={trade.currency} />
        </Field>
        <Field label="R:R">
          <Rr value={trade.rr_ratio} />
        </Field>
        <Field label="Duration">
          {trade.duration_seconds !== null ? `${Math.round(trade.duration_seconds / 60)}m` : '—'}
        </Field>
        <Field label="Entry">{trade.entry_price ?? '—'}</Field>
        <Field label="Exit">{trade.exit_price ?? '—'}</Field>
        <Field label="Quantity">{trade.quantity ?? '—'}</Field>
        <Field label="Closed">
          {trade.closed_at ? new Date(trade.closed_at).toLocaleString() : '—'}
        </Field>
      </dl>

      {trade.notes ? (
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{trade.notes}</p>
        </div>
      ) : null}

      {trade.private_notes ? (
        <>
          <Separator />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">
              Private notes{' '}
              <span className="text-xs font-normal text-muted-foreground">(only you)</span>
            </h2>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {trade.private_notes}
            </p>
          </div>
        </>
      ) : null}

      <Separator />
      <TradeReviewPanel tradeId={trade.id} />
    </div>
  );
}
