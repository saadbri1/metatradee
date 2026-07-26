'use client';

/**
 * Assign / unassign one real trade to a playbook, from the Journal trade
 * detail.
 *
 * The link is `trades.strategy_id` — a single column, so a trade can belong to
 * exactly one playbook and duplicate associations are impossible by
 * construction. Ownership is verified server-side on both the trade and the
 * playbook before the write.
 *
 * The select updates optimistically and ROLLS BACK to the persisted value if
 * the server rejects the change, so the UI never shows an assignment that was
 * not actually saved.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FormAlert } from '@/features/auth/components/form-alert';
import { usePlaybookWorkspace, useAssignTradeToPlaybook } from '../hooks';

const UNASSIGNED = 'none';

export function TradePlaybookAssignment({
  tradeId,
  strategyId,
}: {
  tradeId: string;
  strategyId: string | null;
}) {
  const workspace = usePlaybookWorkspace();
  const assign = useAssignTradeToPlaybook();
  const [value, setValue] = useState<string>(strategyId ?? UNASSIGNED);
  const [error, setError] = useState('');

  // Re-sync when the server sends a different persisted value (e.g. after a
  // refresh or an edit made elsewhere).
  useEffect(() => {
    setValue(strategyId ?? UNASSIGNED);
  }, [strategyId]);

  const playbooks = (workspace.data?.rows ?? []).filter(
    (row) => row.status !== 'archived' || row.id === strategyId,
  );
  const current = playbooks.find((row) => row.id === value);

  function change(next: string) {
    const previous = value;
    setValue(next); // optimistic
    setError('');
    assign.mutate(
      { tradeId, strategyId: next === UNASSIGNED ? null : next },
      {
        onError: (cause) => {
          setValue(previous); // rollback — nothing was persisted
          setError(cause.message);
        },
      },
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="trade-playbook">Playbook</Label>
          <Select value={value} onValueChange={change} disabled={workspace.isLoading}>
            <SelectTrigger id="trade-playbook" className="h-9 max-w-sm">
              <SelectValue placeholder="Not assigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Not assigned</SelectItem>
              {playbooks.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {assign.isPending
              ? 'Saving…'
              : 'Linking this trade updates that playbook’s expectancy, win rate, and profit factor.'}
          </p>
        </div>
        {current ? (
          <Link
            href={`/playbook/${current.id}`}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <ExternalLink className="size-3.5" aria-hidden /> Open {current.name}
          </Link>
        ) : null}
      </div>
      {error ? (
        <div className="mt-2">
          <FormAlert tone="error">{error}</FormAlert>
        </div>
      ) : null}
    </section>
  );
}
