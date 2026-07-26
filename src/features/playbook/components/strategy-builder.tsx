'use client';

/**
 * Create / edit a playbook.
 *
 * A dedicated route rather than a modal: the form is long (identity, markets,
 * eight rule groups, checklist, notes), and the app already uses routed forms
 * for the equivalent Journal workflow.
 *
 * Only fields the domain can actually store are offered. Validation is the
 * SHARED Zod schema, so the client and the server action enforce identical
 * rules — the client cannot approve anything the server would reject.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SubmitButton } from '@/features/auth/components/submit-button';
import { FormAlert } from '@/features/auth/components/form-alert';
import { strategyCreateSchema, type StrategyCreateInput } from '../schemas';
import { RULE_GROUP_META, RULE_GROUP_ORDER } from '../labels';
import { isDuplicateName } from '../naming';
import { useCreateStrategy, useUpdateStrategy } from '../hooks';
import { RuleGroupEditor, ChecklistEditor } from './rule-group-editor';

/** Comma-separated text ⇆ the `text[]` columns the schema stores. */
function toList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 50);
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border/70 bg-card p-4">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      {description ? (
        <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function StrategyBuilder({
  mode = 'create',
  strategyId,
  defaultValues,
  existingNames = [],
}: {
  mode?: 'create' | 'edit';
  strategyId?: string;
  defaultValues?: Partial<StrategyCreateInput>;
  /** Live playbook names, for the client-side duplicate warning. */
  existingNames?: string[];
}) {
  const router = useRouter();
  const create = useCreateStrategy();
  const update = useUpdateStrategy();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<StrategyCreateInput>({
    resolver: zodResolver(strategyCreateSchema),
    defaultValues: {
      name: '',
      description: '',
      category: '',
      market: '',
      asset_class: '',
      color: '',
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

  const dirty = form.formState.isDirty && !saved;

  /**
   * Unsaved-change warning on full page unload. In-app navigation is handled by
   * the explicit Cancel confirmation below; the browser only lets us guard the
   * hard unload path.
   */
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const name = form.watch('name') ?? '';
  const duplicate = isDuplicateName(name, existingNames, defaultValues?.name);

  function onSubmit(values: StrategyCreateInput) {
    setFormError(null);
    // The DB enforces a unique index; this only turns a constraint failure into
    // an actionable message before the round trip.
    if (duplicate) {
      form.setError('name', { message: 'You already have a playbook with this name.' });
      return;
    }

    if (mode === 'edit' && strategyId) {
      update.mutate(
        { id: strategyId, input: values },
        {
          onSuccess: (result) => {
            if (!result.ok) {
              setFormError(result.error ?? 'Could not save your changes.');
              return;
            }
            setSaved(true);
            router.push(`/playbook/${strategyId}`);
            router.refresh();
          },
          onError: (error) => setFormError(error.message),
        },
      );
      return;
    }

    create.mutate(values, {
      onSuccess: (result) => {
        if (!result.ok || !result.data) {
          setFormError(result.error ?? 'Could not create this playbook.');
          return;
        }
        setSaved(true);
        router.push(`/playbook/${result.data.id}`);
        router.refresh();
      },
      onError: (error) => setFormError(error.message),
    });
  }

  function cancel() {
    if (dirty && !window.confirm('Discard your unsaved changes to this playbook?')) return;
    router.push(mode === 'edit' && strategyId ? `/playbook/${strategyId}` : '/playbook');
  }

  const pending = create.isPending || update.isPending;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mx-auto flex max-w-[1100px] flex-col gap-3 pb-16"
        noValidate
        onKeyDown={(event) => {
          // Escape leaves the form, mirroring a dialog's dismiss affordance.
          if (event.key === 'Escape' && event.target === event.currentTarget) cancel();
        }}
      >
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

        <Section
          title="Identity"
          description="What this playbook is and whether you are actively trading it."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Playbook name</FormLabel>
                  <FormControl>
                    <Input autoFocus className="h-9" {...field} />
                  </FormControl>
                  {duplicate ? (
                    <FormDescription className="text-destructive">
                      You already have a playbook with this name.
                    </FormDescription>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Textarea rows={2} {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <Section
          title="Market context"
          description="Where and when you trade this playbook. Comma-separate multiple values."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Setup classification</FormLabel>
                  <FormControl>
                    <Input
                      className="h-9"
                      placeholder="e.g. Breakout, Mean reversion"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="market"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Market</FormLabel>
                  <FormControl>
                    <Input
                      className="h-9"
                      placeholder="e.g. CME futures"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="asset_class"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asset class</FormLabel>
                  <FormControl>
                    <Input
                      className="h-9"
                      placeholder="e.g. futures"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="symbols"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Symbols</FormLabel>
                  <FormControl>
                    <Input
                      className="h-9"
                      placeholder="ES, NQ, MES"
                      value={(field.value ?? []).join(', ')}
                      onChange={(event) => field.onChange(toList(event.target.value))}
                      onBlur={field.onBlur}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timeframes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timeframes</FormLabel>
                  <FormControl>
                    <Input
                      className="h-9"
                      placeholder="1m, 5m, 1h"
                      value={(field.value ?? []).join(', ')}
                      onChange={(event) => field.onChange(toList(event.target.value))}
                      onBlur={field.onBlur}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sessions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sessions</FormLabel>
                  <FormControl>
                    <Input
                      className="h-9"
                      placeholder="London, New York"
                      value={(field.value ?? []).join(', ')}
                      onChange={(event) => field.onChange(toList(event.target.value))}
                      onBlur={field.onBlur}
                    />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    Session or time restrictions you hold yourself to.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Section>

        <Section
          title="Rules"
          description="Your own review criteria. MetaTradee records and measures them — it never places, manages, or automates a trade for you."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {RULE_GROUP_ORDER.map((group) => (
              <RuleGroupEditor
                key={group}
                control={form.control}
                name={group}
                legend={RULE_GROUP_META[group].label}
                help={RULE_GROUP_META[group].help}
              />
            ))}
          </div>
        </Section>

        <Section title="Checklist & notes">
          <ChecklistEditor control={form.control} name="checklist" />
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea rows={4} {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-2 border-t border-border/70 bg-background/95 px-1 py-3 backdrop-blur">
          {dirty ? (
            <span className="mr-auto text-[11px] text-muted-foreground" role="status">
              Unsaved changes
            </span>
          ) : null}
          <Button type="button" variant="ghost" onClick={cancel}>
            Cancel
          </Button>
          <SubmitButton loading={pending} loadingText="Saving…">
            {mode === 'edit' ? 'Save changes' : 'Create Playbook'}
          </SubmitButton>
        </div>
      </form>
    </Form>
  );
}
