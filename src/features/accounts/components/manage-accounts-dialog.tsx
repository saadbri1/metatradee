'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Link2Off, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormAlert } from '@/features/auth/components/form-alert';
import { accountTypeLabel } from '../domain';
import { updateTradingAccountStatusAction } from '../server/actions';
import type { AccountStatus, TradingAccount } from '../types';

export function ManageAccountsDialog({
  accounts,
  open,
  onOpenChange,
}: {
  accounts: TradingAccount[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function changeStatus(id: string, status: AccountStatus) {
    setError(null);
    setActiveId(id);
    startTransition(async () => {
      const result = await updateTradingAccountStatusAction({ id, status });
      if (!result.ok) setError(result.error);
      else router.refresh();
      setActiveId(null);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage trading accounts</DialogTitle>
          <DialogDescription>
            Account identity and imported history stay owner-scoped. Archiving hides an account
            without deleting its trades.
          </DialogDescription>
        </DialogHeader>
        {error ? <FormAlert tone="error">{error}</FormAlert> : null}
        <div className="space-y-3">
          {accounts.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No accounts to manage.
            </p>
          ) : (
            accounts.map((account) => (
              <article
                key={account.id}
                className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold">{account.name}</h3>
                    <Badge variant="secondary">{accountTypeLabel(account.account_type)}</Badge>
                    <Badge variant="outline" className="capitalize">
                      {account.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {account.provider || 'MetaTradee'} · {account.base_currency} ·{' '}
                    {account.connection_method === 'file'
                      ? `File import ${account.import_status.replace(/_/g, ' ')}`
                      : 'Simulation'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {account.account_type !== 'demo' ? (
                    account.status === 'disconnected' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending && activeId === account.id}
                        onClick={() => changeStatus(account.id, 'import_required')}
                      >
                        <RefreshCw aria-hidden /> Require import
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending && activeId === account.id}
                        onClick={() => changeStatus(account.id, 'disconnected')}
                      >
                        <Link2Off aria-hidden /> Disconnect
                      </Button>
                    )
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending && activeId === account.id}
                    onClick={() => changeStatus(account.id, 'archived')}
                  >
                    <Archive aria-hidden /> Archive
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
