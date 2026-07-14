import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/** Titled empty state — consistent with the app's empty-state pattern. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-10 text-center">
      {icon ? (
        <div className="text-muted-foreground" aria-hidden>
          {icon}
        </div>
      ) : null}
      <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}

/** Success confirmation, announced politely to assistive tech. */
export function SuccessState({ children }: { children: ReactNode }) {
  return (
    <p role="status" aria-live="polite" className="text-sm font-medium text-muted-foreground">
      {children}
    </p>
  );
}

/** Form loading skeleton for settings/onboarding surfaces. */
export function FormSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}
