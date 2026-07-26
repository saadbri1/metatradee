'use client';

/**
 * Structured rule and checklist editors.
 *
 * These are journaling and review criteria. MetaTradee never executes a
 * playbook rule, and the editor deliberately offers no automation vocabulary —
 * no triggers, no conditions engine, no "when X then Y".
 *
 * Reordering is exposed as explicit Move up / Move down BUTTONS rather than
 * drag-only, so the order is fully operable from the keyboard (WCAG 2.2:
 * dragging movements must have a single-pointer/keyboard alternative).
 */
import {
  useController,
  useFieldArray,
  type Control,
  type FieldValues,
  type FieldPath,
} from 'react-hook-form';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * A controlled checkbox bound to a react-hook-form field.
 *
 * The previous implementation called `register(...).onChange` with a synthetic
 * object, which never reached form state — the flag looked toggled but saved as
 * false. `useController` writes through the real field.
 */
function RequiredCheckbox<T extends FieldValues>({
  control,
  name,
  label,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
}) {
  const { field } = useController({ control, name });
  return (
    <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
      <Checkbox
        checked={field.value === true}
        onCheckedChange={(checked) => field.onChange(checked === true)}
        onBlur={field.onBlur}
        aria-label={label}
      />
      Required
    </label>
  );
}

export function RuleGroupEditor<T extends FieldValues>({
  control,
  name,
  legend,
  help,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  legend: string;
  help?: string;
}) {
  const { fields, append, remove, move } = useFieldArray({ control, name: name as never });

  return (
    <fieldset className="rounded-md border border-border/70 bg-card p-3">
      <legend className="px-1 text-xs font-semibold">{legend}</legend>
      {help ? <p className="mb-2 text-[11px] leading-4 text-muted-foreground">{help}</p> : null}

      {fields.length === 0 ? (
        <p className="py-1 text-[11px] text-muted-foreground">No rules yet.</p>
      ) : null}

      <ol className="space-y-1.5">
        {fields.map((field, index) => (
          <li key={field.id} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="w-4 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground"
            >
              {index + 1}
            </span>
            <Input
              aria-label={`${legend} rule ${index + 1}`}
              className="h-8 flex-1 text-xs"
              {...control.register(`${name}.${index}.text` as FieldPath<T>)}
            />
            <RequiredCheckbox
              control={control}
              name={`${name}.${index}.required` as FieldPath<T>}
              label={`${legend} rule ${index + 1} is required`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={index === 0}
              aria-label={`Move ${legend} rule ${index + 1} up`}
              onClick={() => move(index, index - 1)}
            >
              <ChevronUp className="size-3.5" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={index === fields.length - 1}
              aria-label={`Move ${legend} rule ${index + 1} down`}
              onClick={() => move(index, index + 1)}
            >
              <ChevronDown className="size-3.5" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`Delete ${legend} rule ${index + 1}`}
              onClick={() => remove(index)}
            >
              <X className="size-3.5" aria-hidden />
            </Button>
          </li>
        ))}
      </ol>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2 h-7 text-xs"
        onClick={() => append({ id: newId(), text: '', required: false } as never)}
      >
        <Plus className="size-3.5" aria-hidden /> Add rule
      </Button>
    </fieldset>
  );
}

export function ChecklistEditor<T extends FieldValues>({
  control,
  name,
}: {
  control: Control<T>;
  name: FieldPath<T>;
}) {
  const { fields, append, remove, move } = useFieldArray({ control, name: name as never });

  return (
    <fieldset className="rounded-md border border-border/70 bg-card p-3">
      <legend className="px-1 text-xs font-semibold">Pre-trade checklist</legend>
      <p className="mb-2 text-[11px] leading-4 text-muted-foreground">
        The ordered checks you run before taking the trade. Order matters — use the arrows to change
        it.
      </p>

      {fields.length === 0 ? (
        <p className="py-1 text-[11px] text-muted-foreground">No checklist items yet.</p>
      ) : null}

      <ol className="space-y-1.5">
        {fields.map((field, index) => (
          <li key={field.id} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="w-4 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground"
            >
              {index + 1}
            </span>
            <Input
              aria-label={`Checklist item ${index + 1}`}
              className="h-8 flex-1 text-xs"
              {...control.register(`${name}.${index}.text` as FieldPath<T>)}
            />
            <RequiredCheckbox
              control={control}
              name={`${name}.${index}.required` as FieldPath<T>}
              label={`Checklist item ${index + 1} is required`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={index === 0}
              aria-label={`Move checklist item ${index + 1} up`}
              onClick={() => move(index, index - 1)}
            >
              <ChevronUp className="size-3.5" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={index === fields.length - 1}
              aria-label={`Move checklist item ${index + 1} down`}
              onClick={() => move(index, index + 1)}
            >
              <ChevronDown className="size-3.5" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`Delete checklist item ${index + 1}`}
              onClick={() => remove(index)}
            >
              <X className="size-3.5" aria-hidden />
            </Button>
          </li>
        ))}
      </ol>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2 h-7 text-xs"
        onClick={() => append({ id: newId(), text: '', required: true } as never)}
      >
        <Plus className="size-3.5" aria-hidden /> Add item
      </Button>
    </fieldset>
  );
}
