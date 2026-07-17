/**
 * Decorative product motif — NOT a real screenshot and NOT a mock dashboard with
 * invented numbers. It is entirely `aria-hidden`, contains zero figures, and
 * exists only as an abstract, on-brand placeholder until real seeded-demo
 * screenshots are wired in (see the marketing GAP REPORT). Skeleton bars stand in
 * for data deliberately, so nothing here can be mistaken for real performance.
 */
export function DashboardPreview({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-primary/10 ${className ?? ''}`}
    >
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
        <span className="size-2.5 rounded-full bg-loss/60" />
        <span className="size-2.5 rounded-full bg-warning/60" />
        <span className="size-2.5 rounded-full bg-profit/60" />
        <span className="ml-3 h-2 w-40 rounded-full bg-muted" />
      </div>
      <div className="grid grid-cols-[64px_1fr] gap-0">
        {/* sidebar rail */}
        <div className="flex flex-col items-center gap-4 border-r border-border/70 py-5">
          <span className="size-7 rounded-lg bg-primary/20" />
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="size-5 rounded-md bg-muted" />
          ))}
        </div>
        {/* content */}
        <div className="space-y-4 p-5">
          {/* KPI tiles — bars, never numbers */}
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-background p-3">
                <span className="block h-1.5 w-10 rounded-full bg-muted" />
                <span
                  className={`mt-3 block h-3 w-16 rounded ${i === 0 ? 'bg-profit/50' : 'bg-foreground/20'}`}
                />
              </div>
            ))}
          </div>
          {/* equity curve — abstract line, no axes/values */}
          <div className="rounded-lg border border-border bg-background p-4">
            <span className="mb-3 block h-1.5 w-24 rounded-full bg-muted" />
            <svg viewBox="0 0 480 140" className="h-32 w-full" role="presentation">
              <defs>
                <linearGradient id="mt-eq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon
                points="0,120 40,110 80,116 120,86 160,92 200,64 240,72 280,44 320,50 360,30 400,36 440,18 480,12 480,140 0,140"
                fill="url(#mt-eq)"
              />
              <polyline
                points="0,120 40,110 80,116 120,86 160,92 200,64 240,72 280,44 320,50 360,30 400,36 440,18 480,12"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>
          {/* rows */}
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
              >
                <span className="size-5 rounded bg-muted" />
                <span className="h-2 w-24 rounded-full bg-muted" />
                <span className="ml-auto h-2 w-12 rounded-full bg-foreground/15" />
                <span
                  className={`h-2 w-10 rounded-full ${i % 2 === 0 ? 'bg-profit/40' : 'bg-loss/40'}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
