import type { LucideIcon } from 'lucide-react';

/**
 * Titled placeholder for a not-yet-built feature route. Follows the empty-state
 * pattern (educate + a single implicit next step). No feature logic.
 */
export function PlaceholderPage({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-12 text-center">
        <Icon className="size-10 text-muted-foreground" aria-hidden />
        <p className="text-lg font-medium">Coming soon</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
