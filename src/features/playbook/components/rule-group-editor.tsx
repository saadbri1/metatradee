'use client';

import { useFieldArray, type Control, type FieldValues, type FieldPath } from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : String(Date.now());
}

/**
 * Editor for a rule group (array of {id,text,required}). Accessible fieldset
 * with labelled inputs; keyboard-operable add/remove.
 */
export function RuleGroupEditor<T extends FieldValues>({
  control,
  name,
  legend,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  legend: string;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: name as never });

  return (
    <fieldset className="space-y-2 rounded-lg border border-border p-3">
      <legend className="px-1 text-sm font-medium">{legend}</legend>
      {fields.length === 0 ? <p className="text-xs text-muted-foreground">No rules yet.</p> : null}
      {fields.map((field, i) => (
        <div key={field.id} className="flex items-center gap-2">
          <Input
            aria-label={`${legend} rule ${i + 1}`}
            className="flex-1"
            {...control.register(`${name}.${i}.text` as FieldPath<T>)}
          />
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <Checkbox
              onCheckedChange={(c) =>
                control.register(`${name}.${i}.required` as FieldPath<T>).onChange({
                  target: { value: c === true, name: `${name}.${i}.required` },
                })
              }
            />
            Req
          </label>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove rule ${i + 1}`}
            onClick={() => remove(i)}
          >
            <X aria-hidden />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ id: newId(), text: '', required: false } as never)}
      >
        <Plus aria-hidden /> Add rule
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
  const { fields, append, remove } = useFieldArray({ control, name: name as never });
  return (
    <fieldset className="space-y-2 rounded-lg border border-border p-3">
      <legend className="px-1 text-sm font-medium">Checklist</legend>
      {fields.map((field, i) => (
        <div key={field.id} className="flex items-center gap-2">
          <Input
            aria-label={`Checklist item ${i + 1}`}
            className="flex-1"
            {...control.register(`${name}.${i}.text` as FieldPath<T>)}
          />
          <Label className="flex items-center gap-1 text-xs text-muted-foreground">
            <Checkbox
              defaultChecked
              onCheckedChange={(c) =>
                control.register(`${name}.${i}.required` as FieldPath<T>).onChange({
                  target: { value: c === true, name: `${name}.${i}.required` },
                })
              }
            />
            Required
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove item ${i + 1}`}
            onClick={() => remove(i)}
          >
            <X aria-hidden />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ id: newId(), text: '', required: true } as never)}
      >
        <Plus aria-hidden /> Add item
      </Button>
    </fieldset>
  );
}
