import { Skeleton } from '@/components/ui/skeleton';

/** Route-level loading UI for the dashboard (no infinite spinner). */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-lg lg:col-span-2" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}
