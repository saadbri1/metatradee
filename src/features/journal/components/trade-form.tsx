'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/features/auth/components/submit-button';
import { FormAlert } from '@/features/auth/components/form-alert';
import { SelectField } from '@/features/workspace/components/fields';
import { tradeCreateSchema, type TradeCreateInput } from '../schemas';
import { ASSET_TYPES, DIRECTIONS, TRADE_SESSIONS } from '../enums';
import { computeDerivedTradeFields } from '../derived';
import { useCreateTrade, useUpdateTrade } from '../hooks';
import { Money, Rr } from './pnl';

const directionOptions = DIRECTIONS.map((v) => ({
  value: v,
  label: v === 'buy' ? 'Buy / Long' : 'Sell / Short',
}));
const assetOptions = ASSET_TYPES.map((v) => ({
  value: v,
  label: v[0]!.toUpperCase() + v.slice(1),
}));
const sessionOptions = TRADE_SESSIONS.map((v) => ({
  value: v,
  label: v.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
}));

function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toIso(local?: string | null): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function numOrNull(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function TradeForm({
  mode = 'create',
  tradeId,
  defaultValues,
}: {
  mode?: 'create' | 'edit';
  tradeId?: string;
  defaultValues?: Partial<TradeCreateInput>;
}) {
  const router = useRouter();
  const create = useCreateTrade();
  const update = useUpdateTrade();
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateOf, setDuplicateOf] = useState<string | null>(null);

  const form = useForm<TradeCreateInput>({
    resolver: zodResolver(tradeCreateSchema),
    defaultValues: {
      symbol: '',
      direction: 'buy',
      currency: 'USD',
      commission: 0,
      swap: 0,
      fees: 0,
      status: 'published',
      visibility: 'private',
      tag_ids: [],
      ...defaultValues,
    },
  });

  const w = form.watch();
  const derived = computeDerivedTradeFields({
    direction: w.direction ?? 'buy',
    entry_price: numOrNull(w.entry_price),
    exit_price: numOrNull(w.exit_price),
    quantity: numOrNull(w.quantity),
    stop_loss: numOrNull(w.stop_loss),
    take_profit: numOrNull(w.take_profit),
    commission: numOrNull(w.commission) ?? 0,
    swap: numOrNull(w.swap) ?? 0,
    fees: numOrNull(w.fees) ?? 0,
    opened_at: toIso(w.opened_at),
    closed_at: toIso(w.closed_at),
  });

  function submit(values: TradeCreateInput, force = false) {
    setFormError(null);
    const payload: TradeCreateInput = {
      ...values,
      opened_at: toIso(values.opened_at),
      closed_at: toIso(values.closed_at),
      executed_at: toIso(values.executed_at),
    };
    if (mode === 'edit' && tradeId) {
      update.mutate(
        { id: tradeId, input: payload },
        {
          onSuccess: (res) => {
            if (res.ok) router.push(`/journal/${tradeId}`);
            else setFormError(res.error);
          },
        },
      );
      return;
    }
    create.mutate(
      { input: payload, force },
      {
        onSuccess: (res) => {
          if (res.ok && res.id) {
            router.push(`/journal/${res.id}`);
          } else if (res.duplicateOf) {
            setDuplicateOf(res.duplicateOf);
          } else {
            setFormError(res.error ?? 'Could not save the trade.');
          }
        },
        onError: () => setFormError('Something went wrong. Please try again.'),
      },
    );
  }

  const pending = create.isPending || update.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => submit(v))} className="space-y-6" noValidate>
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
        {duplicateOf ? (
          <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
            <p className="text-sm">A matching trade already exists.</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => submit(form.getValues(), true)}>
                Save anyway
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setDuplicateOf(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="symbol"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Symbol</FormLabel>
                <FormControl>
                  <Input placeholder="EURUSD" autoFocus {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <SelectField
            control={form.control}
            name="direction"
            label="Direction"
            options={directionOptions}
          />
          <SelectField
            control={form.control}
            name="asset_type"
            label="Asset type"
            options={assetOptions}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {(['entry_price', 'exit_price', 'quantity', 'stop_loss', 'take_profit'] as const).map(
            (name) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="capitalize">{name.replace('_', ' ')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(numOrNull(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ),
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {(['commission', 'swap', 'fees'] as const).map((name) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="capitalize">{name}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(numOrNull(e.target.value) ?? 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {(['opened_at', 'closed_at'] as const).map((name) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{name === 'opened_at' ? 'Opened' : 'Closed'}</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      value={toLocalInput(field.value)}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
          <SelectField
            control={form.control}
            name="session"
            label="Session"
            options={sessionOptions}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div
          className="flex flex-wrap gap-6 rounded-lg border border-border bg-card p-4 text-sm"
          aria-live="polite"
        >
          <div>
            <span className="text-muted-foreground">Net P&amp;L: </span>
            <Money value={derived.net_pnl} currency={w.currency ?? 'USD'} colored />
          </div>
          <div>
            <span className="text-muted-foreground">R:R: </span>
            <Rr value={derived.rr_ratio} />
          </div>
          <div>
            <span className="text-muted-foreground">Duration: </span>
            <span className="tabular">
              {derived.duration_seconds !== null
                ? `${Math.round(derived.duration_seconds / 60)}m`
                : '—'}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <SubmitButton loading={pending} loadingText="Saving…">
            {mode === 'edit' ? 'Save changes' : 'Add trade'}
          </SubmitButton>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
