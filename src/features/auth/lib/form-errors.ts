import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';

/**
 * Apply server-returned field errors (from an AuthActionResult) onto a
 * react-hook-form instance so they render inline via <FormMessage>. Only the
 * first message per field is surfaced.
 */
export function applyFieldErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldErrors: Record<string, string[]>,
): void {
  for (const [name, messages] of Object.entries(fieldErrors)) {
    const message = messages?.[0];
    if (message) {
      form.setError(name as Path<T>, { type: 'server', message });
    }
  }
}
