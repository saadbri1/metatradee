import type { ReactNode } from 'react';

/**
 * Token-built browser chrome (no skeuomorphic stock mockup). Wraps either a real
 * product screenshot (dropped in later via next/image — see the capture script)
 * or, for now, a decorative number-free motif. The chrome itself is `aria-hidden`
 * only around the decorative content; a real screenshot passes its own alt.
 */
export function DeviceFrame({
  children,
  url = 'metatradee.app',
  className,
  decorative = true,
}: {
  children: ReactNode;
  url?: string;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-primary/10 ${className ?? ''}`}
      {...(decorative ? { 'aria-hidden': true } : {})}
    >
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-loss/60" />
        <span className="size-2.5 rounded-full bg-warning/60" />
        <span className="size-2.5 rounded-full bg-profit/60" />
        <span className="ml-3 flex-1 truncate rounded-md bg-muted/60 px-2 py-1 text-center text-[10px] text-muted-foreground">
          {url}
        </span>
      </div>
      {children}
    </div>
  );
}
