import { Skeleton } from '@/components/ui/skeleton';

/** Route-level loading UI for the dashboard (no infinite spinner). */
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-muted/40" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex h-[68px] items-center justify-between border-b border-border/70 bg-card px-5 md:px-6">
        <Skeleton className="h-6 w-28" />
        <div className="flex gap-2">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
      <div className="mx-auto max-w-[1680px] space-y-4 px-5 py-4 md:px-6">
        <div className="flex h-10 items-center justify-between">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-10 w-72" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[327px] rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-[32rem] rounded-xl" />
        </div>
      </div>
    </div>
  );
}
