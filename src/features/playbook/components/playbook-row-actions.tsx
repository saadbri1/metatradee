'use client';

/**
 * Row action menu shared by the table and the grid.
 *
 * Every item here performs a real, persisted mutation. Destructive actions go
 * through an explicit confirmation dialog that states the effect on linked
 * trades — never a toast-only workflow.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive,
  ArchiveRestore,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormAlert } from '@/features/auth/components/form-alert';
import type { PlaybookListRow } from '../filters';

export interface RowActionHandlers {
  onDuplicate: (row: PlaybookListRow) => Promise<void>;
  onArchive: (row: PlaybookListRow) => Promise<void>;
  onRestore: (row: PlaybookListRow) => Promise<void>;
  onDelete: (row: PlaybookListRow) => Promise<void>;
  onPin: (row: PlaybookListRow) => Promise<void>;
  pending: boolean;
}

/**
 * Playbook sharing has no backing architecture — no share table, no permission
 * model, no server-side authorization. The control is therefore rendered
 * disabled with the exact reason rather than removed, so its absence is
 * explained rather than mysterious.
 */
const SHARING_REASON =
  'Sharing is unavailable: MetaTradee has no playbook sharing or permission model yet.';

export function PlaybookRowActions({
  row,
  actions,
}: {
  row: PlaybookListRow;
  actions: RowActionHandlers;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const archived = row.status === 'archived';
  const linked = row.metrics.kpis.totalTrades;

  async function run(fn: () => Promise<void>) {
    setError('');
    try {
      await fn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong.');
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={`Actions for ${row.name}`}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => router.push(`/playbook/${row.id}`)}>
            <ExternalLink aria-hidden /> Open
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push(`/playbook/${row.id}/edit`)}>
            <Pencil aria-hidden /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void run(() => actions.onDuplicate(row))}>
            <Copy aria-hidden /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void run(() => actions.onPin(row))}>
            <Star aria-hidden /> {row.is_pinned ? 'Unpin' : 'Pin to top'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => router.push(`/journal?strategy=${encodeURIComponent(row.id)}`)}
          >
            <ExternalLink aria-hidden /> View {linked > 0 ? `${linked} ` : ''}linked trades
          </DropdownMenuItem>
          <DropdownMenuItem disabled aria-disabled title={SHARING_REASON}>
            <Users aria-hidden /> Share
            <span className="sr-only"> — {SHARING_REASON}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {archived ? (
            <DropdownMenuItem onSelect={() => void run(() => actions.onRestore(row))}>
              <ArchiveRestore aria-hidden /> Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => void run(() => actions.onArchive(row))}>
              <Archive aria-hidden /> Archive
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(event) => {
              event.preventDefault();
              setConfirmDelete(true);
            }}
          >
            <Trash2 aria-hidden /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{row.name}”?</DialogTitle>
            <DialogDescription>
              {linked > 0
                ? `${linked} linked trade${linked === 1 ? '' : 's'} will be kept and simply unlinked from this playbook. No trade is deleted.`
                : 'This playbook has no linked trades. No trade data is affected.'}{' '}
              Rules, checklist, and version history are removed from your active list.
            </DialogDescription>
          </DialogHeader>
          {error ? <FormAlert tone="error">{error}</FormAlert> : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={actions.pending}
              onClick={async () => {
                setError('');
                try {
                  await actions.onDelete(row);
                  setConfirmDelete(false);
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : 'Delete failed.');
                }
              }}
            >
              {actions.pending ? 'Deleting…' : 'Delete playbook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && !confirmDelete ? (
        <span role="alert" className="sr-only">
          {error}
        </span>
      ) : null}
    </>
  );
}
