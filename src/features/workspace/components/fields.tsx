'use client';

import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { Option } from '../config';

interface BaseFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: string;
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  options,
  placeholder = 'Select…',
}: BaseFieldProps<T> & { options: Option[]; placeholder?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select value={(field.value as string) ?? ''} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function SwitchField<T extends FieldValues>({
  control,
  name,
  label,
  description,
}: BaseFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between gap-4 space-y-0 rounded-lg border border-border p-4">
          <div className="space-y-0.5">
            <FormLabel>{label}</FormLabel>
            {description ? <FormDescription>{description}</FormDescription> : null}
          </div>
          <FormControl>
            <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

/**
 * Multi-select rendered as toggleable chips. `field.value` is a string[]. Each
 * chip is a real button with `aria-pressed` for keyboard + screen-reader use.
 */
export function ChipMultiSelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  options,
}: BaseFieldProps<T> & { options: Option[] }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selected: string[] = Array.isArray(field.value) ? field.value : [];
        const toggle = (value: string) => {
          field.onChange(
            selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
          );
        };
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
              {options.map((opt) => {
                const active = selected.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    aria-pressed={active}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      active
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {description ? <FormDescription>{description}</FormDescription> : null}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
