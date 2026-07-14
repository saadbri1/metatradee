'use client';

import { useState } from 'react';
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
import { SubmitButton } from '@/features/auth/components/submit-button';
import { FormAlert } from '@/features/auth/components/form-alert';
import { tradingProfileSchema, type TradingProfileInput } from '../schemas';
import {
  ACCOUNT_SIZE_BANDS,
  CURRENCIES,
  EXPERIENCE_LEVELS,
  MARKETS,
  RISK_PROFILES,
  TRADING_GOALS,
  TRADING_SESSIONS,
  TRADING_STYLES,
  toOptions,
  type Option,
} from '../config';
import { useSaveTradingProfile } from '../hooks/use-workspace-mutations';
import { SelectField, ChipMultiSelectField } from './fields';

const currencyOptions: Option[] = CURRENCIES.map((c) => ({ value: c, label: c }));

export function TradingProfileForm({
  defaultValues,
  submitLabel = 'Save trading profile',
  onSaved,
}: {
  defaultValues?: Partial<TradingProfileInput>;
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const save = useSaveTradingProfile();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<TradingProfileInput>({
    resolver: zodResolver(tradingProfileSchema),
    defaultValues: {
      markets: [],
      goals: [],
      preferred_sessions: [],
      base_currency: 'USD',
      primary_broker: '',
      ...defaultValues,
    },
  });

  function onSubmit(values: TradingProfileInput) {
    setFormError(null);
    setSaved(false);
    save.mutate(values, {
      onSuccess: (result) => {
        if (result.ok) {
          setSaved(true);
          onSaved?.();
          return;
        }
        setFormError(result.error);
      },
      onError: () => setFormError('Something went wrong. Please try again.'),
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
        {saved ? <FormAlert tone="success">Trading profile saved.</FormAlert> : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            control={form.control}
            name="experience"
            label="Experience"
            options={toOptions(EXPERIENCE_LEVELS)}
          />
          <SelectField
            control={form.control}
            name="trading_style"
            label="Primary style"
            options={toOptions(TRADING_STYLES)}
          />
          <SelectField
            control={form.control}
            name="account_size_band"
            label="Account size"
            options={toOptions(ACCOUNT_SIZE_BANDS)}
          />
          <SelectField
            control={form.control}
            name="base_currency"
            label="Base currency"
            options={currencyOptions}
          />
          <SelectField
            control={form.control}
            name="risk_profile"
            label="Risk profile"
            options={toOptions(RISK_PROFILES)}
          />
          <FormField
            control={form.control}
            name="primary_broker"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary broker</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Interactive Brokers" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <ChipMultiSelectField
          control={form.control}
          name="markets"
          label="Markets you trade"
          options={toOptions(MARKETS)}
        />
        <ChipMultiSelectField
          control={form.control}
          name="preferred_sessions"
          label="Preferred sessions"
          options={toOptions(TRADING_SESSIONS)}
        />
        <ChipMultiSelectField
          control={form.control}
          name="goals"
          label="Your goals"
          options={toOptions(TRADING_GOALS)}
        />

        <SubmitButton loading={save.isPending} loadingText="Saving…">
          {submitLabel}
        </SubmitButton>
      </form>
    </Form>
  );
}
