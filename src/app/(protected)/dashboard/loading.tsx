import { Skeleton } from '@/components/ui/skeleton';

/** Route-level loading UI for the dashboard (no infinite spinner). */
export default function DashboardLoading() {
  return (
    <div
      className="-mx-4 -my-6 min-h-[calc(100vh-3.5rem)] space-y-5 bg-[#f6f7f9] px-4 py-5 md:-mx-6 md:px-6"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <Skeleton className="h-[66px] rounded-xl" />
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-80 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[.92fr_2.16fr]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-[32rem] rounded-xl" />
      </div>
    </div>
  );
}
