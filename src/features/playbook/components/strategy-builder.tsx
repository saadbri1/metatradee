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
import { SubmitButton } from '@/features/auth/components/submit-button';
import { FormAlert } from '@/features/auth/components/form-alert';
import { strategyCreateSchema, type StrategyCreateInput } from '../schemas';
import { RULE_GROUPS } from '../types';
import { useCreateStrategy, useUpdateStrategy } from '../hooks';
import { RuleGroupEditor, ChecklistEditor } from './rule-group-editor';

const RULE_LABELS: Record<(typeof RULE_GROUPS)[number], string> = {
  entry_rules: 'Entry rules',
  exit_rules: 'Exit rules',
  stop_loss_rules: 'Stop-loss rules',
  take_profit_rules: 'Take-profit rules',
  position_sizing_rules: 'Position sizing',
  risk_rules: 'Risk rules',
  confirmation_rules: 'Confirmation rules',
  invalidation_rules: 'Invalidation rules',
};

export function StrategyBuilder({
  mode = 'create',
  strategyId,
  defaultValues,
}: {
  mode?: 'create' | 'edit';
  strategyId?: string;
  defaultValues?: Partial<StrategyCreateInput>;
}) {
  const router = useRouter();
  const create = useCreateStrategy();
  const update = useUpdateStrategy();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<StrategyCreateInput>({
    resolver: zodResolver(strategyCreateSchema),
    defaultValues: {
      name: '',
      description: '',
      category: '',
      market: '',
      asset_class: '',
      symbols: [],
      timeframes: [],
      sessions: [],
      entry_rules: [],
      exit_rules: [],
      stop_loss_rules: [],
      take_profit_rules: [],
      position_sizing_rules: [],
      risk_rules: [],
      confirmation_rules: [],
      invalidation_rules: [],
      checklist: [],
      notes: '',
      status: 'active',
      ...defaultValues,
    },
  });

  function onSubmit(values: StrategyCreateInput) {
    setFormError(null);
    if (mode === 'edit' && strategyId) {
      update.mutate(
        { id: strategyId, input: values },
        {
          onSuccess: (r) =>
            r.ok ? router.push(`/playbook/${strategyId}`) : setFormError(r.error ?? 'Failed'),
        },
      );
      return;
    }
    create.mutate(values, {
      onSuccess: (r) =>
        r.ok && r.data ? router.push(`/playbook/${r.data.id}`) : setFormError(r.error ?? 'Failed'),
    });
  }

  const pending = create.isPending || update.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input autoFocus {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Smart Money Concepts" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {RULE_GROUPS.map((g) => (
            <RuleGroupEditor key={g} control={form.control} name={g} legend={RULE_LABELS[g]} />
          ))}
        </div>

        <ChecklistEditor control={form.control} name="checklist" />

        <div className="flex gap-2">
          <SubmitButton loading={pending} loadingText="Saving…">
            {mode === 'edit' ? 'Save changes' : 'Create strategy'}
          </SubmitButton>
          <SubmitButton type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </SubmitButton>
        </div>
      </form>
    </Form>
  );
}
