import { z } from 'zod';

/**
 * The configurable Dashboard surfaces, grouped by the region they occupy in the
 * professional analytics layout. Reordering is scoped to a region so a widget
 * can never move into a column it was not designed for.
 *
 * `summary` — the full-width performance summary band.
 * `primary` — the left rail (win rates and positions).
 * `secondary` — the right column (P&L workspace and calendar).
 *
 * Performance Summary is one widget: its internal Net P&L / Profit Factor /
 * Average Win / Average Loss statistics are fixed and are NOT independently
 * configurable, because the registry has no concept of sub-widgets.
 */
export const DASHBOARD_WIDGETS = [
  { id: 'performance-summary', label: 'Performance summary', region: 'summary' },
  { id: 'winning-trades', label: 'Winning % by Trades', region: 'primary' },
  { id: 'winning-days', label: 'Winning % by Days', region: 'primary' },
  { id: 'positions', label: 'Open Positions / Recent Trades', region: 'primary' },
  { id: 'pnl-workspace', label: 'Daily Net Cumulative P&L / Net Daily P&L', region: 'secondary' },
  { id: 'calendar', label: 'Trading Calendar', region: 'secondary' },
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGETS)[number]['id'];
export type DashboardWidgetRegion = (typeof DASHBOARD_WIDGETS)[number]['region'];

const widgetIdSchema = z.enum(
  DASHBOARD_WIDGETS.map((widget) => widget.id) as [DashboardWidgetId, ...DashboardWidgetId[]],
);

/**
 * Version 2 accompanies the professional analytics rebuild, which replaced the
 * whole widget set. A stored version-1 layout references widget ids that no
 * longer exist, so it fails validation and `normalizeDashboardWidgetLayout`
 * falls back to the current defaults rather than rendering a stale layout.
 */
export const DASHBOARD_WIDGET_LAYOUT_VERSION = 2;

export const dashboardWidgetLayoutSchema = z.object({
  version: z.literal(DASHBOARD_WIDGET_LAYOUT_VERSION),
  order: z
    .array(widgetIdSchema)
    .length(DASHBOARD_WIDGETS.length)
    .refine((value) => new Set(value).size === DASHBOARD_WIDGETS.length, {
      message: 'Widget order must contain every widget exactly once.',
    }),
  hidden: z.array(widgetIdSchema).refine((value) => new Set(value).size === value.length, {
    message: 'Hidden widgets must be unique.',
  }),
});

export type DashboardWidgetLayout = z.infer<typeof dashboardWidgetLayoutSchema>;

export const DEFAULT_DASHBOARD_WIDGET_LAYOUT: DashboardWidgetLayout = {
  version: DASHBOARD_WIDGET_LAYOUT_VERSION,
  order: DASHBOARD_WIDGETS.map((widget) => widget.id),
  hidden: [],
};

export function normalizeDashboardWidgetLayout(value: unknown): DashboardWidgetLayout {
  const parsed = dashboardWidgetLayoutSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ...DEFAULT_DASHBOARD_WIDGET_LAYOUT,
      order: [...DEFAULT_DASHBOARD_WIDGET_LAYOUT.order],
    };
  }
  return {
    version: DASHBOARD_WIDGET_LAYOUT_VERSION,
    order: [...parsed.data.order],
    hidden: [...parsed.data.hidden],
  };
}

/**
 * The Dashboard must never be edited down to nothing, so the final visible
 * widget cannot be hidden. The caller disables the control and states why.
 */
export function canHideDashboardWidget(
  layout: DashboardWidgetLayout,
  id: DashboardWidgetId,
): boolean {
  const hidden = new Set(layout.hidden);
  if (hidden.has(id)) return false;
  return layout.order.filter((widgetId) => !hidden.has(widgetId)).length > 1;
}

export function widgetDefinition(id: DashboardWidgetId) {
  return DASHBOARD_WIDGETS.find((widget) => widget.id === id)!;
}

export function visibleWidgetIds(
  layout: DashboardWidgetLayout,
  region: DashboardWidgetRegion,
): DashboardWidgetId[] {
  const hidden = new Set(layout.hidden);
  return layout.order.filter((id) => widgetDefinition(id).region === region && !hidden.has(id));
}

export function moveDashboardWidget(
  layout: DashboardWidgetLayout,
  id: DashboardWidgetId,
  direction: 'up' | 'down',
): DashboardWidgetLayout {
  const region = widgetDefinition(id).region;
  const hidden = new Set(layout.hidden);
  const peers = layout.order.filter(
    (widgetId) => widgetDefinition(widgetId).region === region && !hidden.has(widgetId),
  );
  const peerIndex = peers.indexOf(id);
  const swapWith = direction === 'up' ? peers[peerIndex - 1] : peers[peerIndex + 1];
  if (!swapWith) return layout;

  const order = [...layout.order];
  const currentIndex = order.indexOf(id);
  const swapIndex = order.indexOf(swapWith);
  [order[currentIndex], order[swapIndex]] = [order[swapIndex]!, order[currentIndex]!];
  return { ...layout, order };
}

export function dashboardWidgetLayoutsEqual(
  first: DashboardWidgetLayout,
  second: DashboardWidgetLayout,
): boolean {
  return (
    first.hidden.length === second.hidden.length &&
    first.order.every((id, index) => second.order[index] === id) &&
    first.hidden.every((id, index) => second.hidden[index] === id)
  );
}
