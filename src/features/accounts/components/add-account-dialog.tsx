'use client';

import { useRef, useState, useTransition, type FormEvent, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { Landmark, MonitorUp, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormAlert } from '@/features/auth/components/form-alert';
import { ADAPTERS } from '@/features/import/adapters';
import { cn } from '@/lib/utils';
import { createTradingAccountAction } from '../server/actions';
import type { AccountType } from '../types';

const TYPES = [
  {
    id: 'broker' as const,
    label: 'Broker account',
    description: 'Track supported CSV or JSON imports. Live connection is not available yet.',
    icon: Landmark,
  },
  {
    id: 'demo' as const,
    label: 'Demo account',
    description: 'Create a simulated account with a deterministic starting balance.',
    icon: MonitorUp,
  },
  {
    id: 'funded' as const,
    label: 'Funded account',
    description: 'Track a prop-firm account through supported file imports or manual trades.',
    icon: Trophy,
  },
];

export function AddAccountDialog({
  open,
  onOpenChange,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const submitting = useRef(false);
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<AccountType>('broker');
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('generic');
  const [externalId, setExternalId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [startingBalance, setStartingBalance] = useState('100000');
  const [accountSize, setAccountSize] = useState('100000');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setType('broker');
    setName('');
    setProvider('generic');
    setExternalId('');
    setCurrency('USD');
    setStartingBalance('100000');
    setAccountSize('100000');
    setError(null);
  }

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (submitting.current || pending || !name.trim()) return;
    submitting.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const selectedAdapter = ADAPTERS.find((adapter) => adapter.id === provider);
        const result = await createTradingAccountAction({
          account_type: type,
          name,
          provider: type === 'broker' ? selectedAdapter?.label || provider : provider,
          external_account_identifier: externalId,
          base_currency: currency,
          starting_balance: Number(startingBalance),
          account_size: type === 'funded' ? Number(accountSize) : undefined,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        changeOpen(false);
        router.refresh();
      } catch {
        setError('Unable to create the account. Please try again.');
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        onCloseAutoFocus={(event) => {
          if (!returnFocusTo?.current) return;
          event.preventDefault();
          returnFocusTo.current.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Add a trading account</DialogTitle>
          <DialogDescription>
            Choose the account model MetaTradee should use. No broker passwords or API secrets are
            requested.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Account type">
            {TYPES.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={type === option.id}
                onClick={() => {
                  setType(option.id);
                  setProvider(option.id === 'broker' ? 'generic' : '');
                }}
                className={cn(
                  'rounded-xl border p-4 text-left transition duration-fast ease-standard motion-reduce:transition-none',
                  type === option.id
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:-translate-y-0.5 hover:border-primary/40',
                )}
              >
                <option.icon className="mb-3 size-5 text-primary" aria-hidden />
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {option.description}
                </span>
              </button>
            ))}
          </div>

          {error ? <FormAlert tone="error">{error}</FormAlert> : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="account-name">Account name</Label>
              <Input
                id="account-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Evaluation 100K"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="account-provider">
                {type === 'funded'
                  ? 'Firm / provider'
                  : type === 'broker'
                    ? 'Import platform'
                    : 'Provider'}
              </Label>
              {type === 'broker' ? (
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger id="account-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADAPTERS.map((adapter) => (
                      <SelectItem key={adapter.id} value={adapter.id}>
                        {adapter.label} file import
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="account-provider"
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  placeholder={type === 'funded' ? 'Prop firm name' : 'MetaTradee Simulation'}
                  disabled={type === 'demo'}
                />
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="account-external-id">
                External account ID{' '}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="account-external-id"
                value={externalId}
                onChange={(event) => setExternalId(event.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="account-currency">Base currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="account-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="account-starting-balance">Starting balance</Label>
              <Input
                id="account-starting-balance"
                type="number"
                min="0"
                step="0.01"
                value={startingBalance}
                onChange={(event) => setStartingBalance(event.target.value)}
              />
            </div>

            {type === 'funded' ? (
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="account-size">Account size</Label>
                <Input
                  id="account-size"
                  type="number"
                  min="0"
                  step="0.01"
                  value={accountSize}
                  onChange={(event) => setAccountSize(event.target.value)}
                />
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded-lg border border-border bg-muted/45 px-4 py-3 text-xs leading-5 text-muted-foreground">
            {type === 'broker'
              ? 'Supported workflow: export trades from the selected platform and import the file. Live OAuth/API synchronization is coming soon.'
              : type === 'demo'
                ? 'Demo balances are deterministic: starting balance plus realized replay or journal P&L. Market prices are never fabricated.'
                : 'Funded rules, payouts, drawdown limits, and violations are not inferred. Only imported or manually recorded trades are analyzed.'}
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => changeOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? 'Creating…' : 'Create account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
