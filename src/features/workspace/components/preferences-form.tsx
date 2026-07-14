'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from 'next-themes';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Form,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { SubmitButton } from '@/features/auth/components/submit-button';
import { FormAlert } from '@/features/auth/components/form-alert';
import { useUIStore, type Density } from '@/store/ui-store';
import { preferencesSchema, type PreferencesInput } from '../schemas';
import {
  CURRENCIES,
  DATE_FORMATS,
  TIME_FORMATS,
  RISK_UNITS,
  THEMES,
  DENSITIES,
  toOptions,
  type Option,
} from '../config';
import { useUpdatePreferences } from '../hooks/use-workspace-mutations';
import { FormSection } from './form-section';
import { SelectField, SwitchField } from './fields';

const themeOptions: Option[] = THEMES.map((v) => ({
  value: v,
  label: v[0]!.toUpperCase() + v.slice(1),
}));
const densityOptions: Option[] = DENSITIES.map((v) => ({
  value: v,
  label: v[0]!.toUpperCase() + v.slice(1),
}));
const currencyOptions: Option[] = CURRENCIES.map((c) => ({ value: c, label: c }));
const dateFormatOptions: Option[] = DATE_FORMATS.map((f) => ({ value: f, label: f }));
const timeFormatOptions = toOptions(TIME_FORMATS);
const riskUnitOptions = toOptions(RISK_UNITS);
const fontScaleOptions = [
  { value: '0.875', label: 'Small' },
  { value: '1', label: 'Default' },
  { value: '1.125', label: 'Large' },
  { value: '1.25', label: 'Extra large' },
];

export function PreferencesForm({
  defaultValues,
  submitLabel = 'Save preferences',
  onSaved,
}: {
  defaultValues?: Partial<PreferencesInput>;
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const update = useUpdatePreferences();
  const { setTheme } = useTheme();
  const setDensity = useUIStore((s) => s.setDensity);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<PreferencesInput>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      theme: 'system',
      density: 'comfortable',
      currency: 'USD',
      date_format: 'YYYY-MM-DD',
      time_format: '24h',
      risk_unit: 'R',
      reduced_motion: false,
      font_scale: 1,
      auto_save: true,
      notify_email: true,
      notify_push: false,
      notify_product: true,
      ...defaultValues,
    },
  });

  // Optimistic live-apply: theme + density take effect immediately on change.
  const theme = form.watch('theme');
  const density = form.watch('density');
  useEffect(() => {
    if (theme) setTheme(theme);
  }, [theme, setTheme]);
  useEffect(() => {
    if (density) setDensity(density as Density);
  }, [density, setDensity]);

  function onSubmit(values: PreferencesInput) {
    setFormError(null);
    setSaved(false);
    update.mutate(values, {
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" noValidate>
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
        {saved ? <FormAlert tone="success">Preferences saved.</FormAlert> : null}

        <FormSection title="Appearance" description="Applied instantly as you change them.">
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField control={form.control} name="theme" label="Theme" options={themeOptions} />
            <SelectField
              control={form.control}
              name="density"
              label="Density"
              options={densityOptions}
            />
            <FormField
              control={form.control}
              name="font_scale"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Font size</FormLabel>
                  <Select
                    value={String(field.value ?? 1)}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {fontScaleOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <SwitchField
            control={form.control}
            name="reduced_motion"
            label="Reduce motion"
            description="Minimize animations and transitions."
          />
        </FormSection>

        <Separator />

        <FormSection title="Formatting" description="How numbers, dates, and risk display.">
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="currency"
              label="Currency"
              options={currencyOptions}
            />
            <SelectField
              control={form.control}
              name="risk_unit"
              label="Risk unit"
              options={riskUnitOptions}
            />
            <SelectField
              control={form.control}
              name="date_format"
              label="Date format"
              options={dateFormatOptions}
            />
            <SelectField
              control={form.control}
              name="time_format"
              label="Time format"
              options={timeFormatOptions}
            />
          </div>
        </FormSection>

        <Separator />

        <FormSection title="Notifications" description="Where we can reach you.">
          <div className="space-y-3">
            <SwitchField control={form.control} name="notify_email" label="Email" />
            <SwitchField control={form.control} name="notify_push" label="Push" />
            <SwitchField control={form.control} name="notify_product" label="Product updates" />
          </div>
        </FormSection>

        <Separator />

        <FormSection title="Editing">
          <SwitchField
            control={form.control}
            name="auto_save"
            label="Auto-save"
            description="Save changes automatically as you work."
          />
        </FormSection>

        <SubmitButton loading={update.isPending} loadingText="Saving…">
          {submitLabel}
        </SubmitButton>
      </form>
    </Form>
  );
}
