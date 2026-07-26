import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils';

/**
 * The MetaTradee brand lockup for the public site.
 *
 * The mark is an ORIGINAL geometric glyph drawn from the product itself — three
 * ascending bars (the equity curve) rising out of a rounded tile, in the
 * MetaTradee blue→iris gradient. It is deliberately abstract: no animal, no
 * mascot, nothing borrowed from another product.
 *
 * Sizing is driven by one `size` prop so the header, footer and mobile drawer
 * scale together instead of drifting apart.
 */
export function BrandMark({ className, size = 44 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id="mt-mark" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(var(--primary))" />
          <stop offset="1" stopColor="hsl(var(--iris))" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#mt-mark)" />
      {/* Three ascending bars — the equity curve, abstracted. */}
      <rect x="12" y="27" width="5.5" height="10" rx="2.75" fill="white" fillOpacity="0.72" />
      <rect x="21.25" y="20" width="5.5" height="17" rx="2.75" fill="white" fillOpacity="0.88" />
      <rect x="30.5" y="11" width="5.5" height="26" rx="2.75" fill="white" />
    </svg>
  );
}

/**
 * Mark + wordmark. `compact` drops the descriptor line for tight surfaces such
 * as the mobile drawer header.
 */
export function BrandLockup({
  className,
  size = 44,
  compact = false,
}: {
  className?: string;
  size?: number;
  compact?: boolean;
}) {
  return (
    <span className={cn('flex items-center gap-3', className)}>
      <BrandMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.375rem] font-semibold tracking-tight text-foreground">
          {siteConfig.name}
        </span>
        {compact ? null : (
          <span className="mt-1 hidden text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground lg:block">
            Trading Journal
          </span>
        )}
      </span>
    </span>
  );
}
