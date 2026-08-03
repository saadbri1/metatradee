import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * THE workspace panel. One chrome for every surface in the authenticated app.
 *
 * It exists because there were three: the `Card` primitive
 * (`rounded-xl border bg-card shadow`, `p-6`), the dashboard's `AnalyticsCard`,
 * and the KPI frame — the last two being the same hand-written string repeated
 * inline, free to drift apart. Different radius, different border weight,
 * different shadow, different padding, all visible side by side on one page.
 *
 * Panel is deliberately quieter than Card. A dense workspace stacks dozens of
 * these; at Card's radius, padding and shadow the page reads as a pile of
 * floating objects rather than an instrument panel. Structure comes from the
 * border and the rhythm between panels, not from depth.
 *
 * `Card` is intentionally left in place. Migrating every call site belongs with
 * the surfaces that use them, not with a shell-and-dashboard slice.
 */
const Panel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    /** Renders as <section> when given an accessible name. */
    as?: 'div' | 'section';
    /** Lifts the panel one elevation step. Use sparingly — it means "on top of". */
    raised?: boolean;
  }
>(({ className, as: Tag = 'div', raised = false, ...props }, ref) => (
  <Tag
    ref={ref}
    className={cn(
      'flex flex-col overflow-hidden rounded-md border border-border/70 text-card-foreground',
      raised ? 'bg-surface-raised shadow-raised' : 'bg-card shadow-panel',
      className,
    )}
    {...props}
  />
));
Panel.displayName = 'Panel';

/**
 * Panel header. Fixed height so a row of panels aligns along its title baseline
 * even when the titles wrap differently — previously each panel set its own.
 */
const PanelHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex h-[52px] shrink-0 items-center gap-2 border-b border-border/70 px-panel',
        className,
      )}
      {...props}
    />
  ),
);
PanelHeader.displayName = 'PanelHeader';

/**
 * Panel title. Renders an <h3> by default: panels sit under a page <h1> and a
 * section <h2>, so h3 keeps the outline correct. Override via `as` where the
 * surrounding structure genuinely differs.
 */
const PanelTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & { as?: 'h2' | 'h3' | 'h4' }
>(({ className, as: Tag = 'h3', ...props }, ref) => (
  <Tag
    ref={ref}
    className={cn('truncate text-panel-title font-semibold text-foreground', className)}
    {...props}
  />
));
PanelTitle.displayName = 'PanelTitle';

/** Panel body. `min-h-0 flex-1` so a chart inside can size to the panel. */
const PanelBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('min-h-0 flex-1 p-panel', className)} {...props} />
  ),
);
PanelBody.displayName = 'PanelBody';

export { Panel, PanelHeader, PanelTitle, PanelBody };
