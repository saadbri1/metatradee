import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils';

/**
 * The official MetaTradee mark — "The Tier".
 *
 * Two rounded planes: a grounded base and a meta-plane shifted +5,+5 that
 * overshoots the base on the right. Geometry is fixed by the identity spec and
 * must not be redrawn:
 *
 *   viewBox      0 0 32 32
 *   meta-plane   x=8.5  y=8     w=20  h=6.5  rx=2.2
 *   base plane   x=3.5  y=17.5  w=20  h=6.5  rx=2.2
 *
 * COLOUR IS TOKEN-DRIVEN, and the existing global tokens already carry the
 * specified values exactly — so the correct lockup appears in both appearances
 * without touching a single brand token:
 *
 *   light   meta `--primary` #3D4FE0 · base `--foreground` #0E1016
 *   dark    meta `--primary` #5B6CFF · base `--foreground` #F3F5F9
 *
 * No chart, no arrow, no letter, no tile, no gradient.
 */
export function BrandMark({ className, size = 44 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn('shrink-0', className)}
    >
      {/* Meta-plane — rises above and overshoots the base to the right. */}
      <rect x="8.5" y="8" width="20" height="6.5" rx="2.2" fill="hsl(var(--primary))" />
      {/* Base plane — grounded. */}
      <rect x="3.5" y="17.5" width="20" height="6.5" rx="2.2" fill="hsl(var(--foreground))" />
    </svg>
  );
}

/**
 * Mark + wordmark, in the proportions the spec locks (42px mark : 27px
 * wordmark : 16px gap). Deriving both from `size` keeps the header, footer,
 * drawer and auth surfaces on one lockup instead of drifting.
 *
 * The lockup is the mark and the word "MetaTradee" — nothing else. There is no
 * descriptor, subtitle or tagline inside it.
 */
export function BrandLockup({ className, size = 44 }: { className?: string; size?: number }) {
  return (
    <span className={cn('flex items-center', className)} style={{ gap: `${size * 0.381}px` }}>
      <BrandMark size={size} />
      <span
        className="font-display font-semibold leading-none tracking-[-0.03em] text-foreground"
        style={{ fontSize: `${size * 0.643}px` }}
      >
        {siteConfig.name}
      </span>
    </span>
  );
}
