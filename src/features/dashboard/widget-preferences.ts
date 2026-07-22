import { z } from 'zod';

export const DASHBOARD_WIDGETS = [
  { id: 'net-pnl', label: 'Net P&L', region: 'kpi' },
  { id: 'trade-expectancy', label: 'Trade expectancy', region: 'kpi' },
  { id: 'profit-factor', label: 'Profit factor', region: 'kpi' },
  { id: 'win-rate', label: 'Win rate', region: 'kpi' },
  { id: 'average-win-loss', label: 'Average win/loss trade', region: 'kpi' },
  { id: 'metatradee-score', label: 'MetaTradee Score', region: 'analytics' },
  {
    id: 'cumulative-pnl',
    label: 'Daily net cumulative P&L',
    region: 'analytics',
  },
  { id: 'daily-pnl', label: 'Net daily P&L', region: 'analytics' },
  { id: 'trades', label: 'Open positions / Recent trades', region: 'lower' },
  { id: 'calendar', label: 'Trading calendar', region: 'lower' },
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGETS)[number]['id'];
export type DashboardWidgetRegion = (typeof DASHBOARD_WIDGETS)[number]['region'];

const widgetIdSchema = z.enum(
  DASHBOARD_WIDGETS.map((widget) => widget.id) as [DashboardWidgetId, ...DashboardWidgetId[]],
);

export const dashboardWidgetLayoutSchema = z.object({
  version: z.literal(1),
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
  version: 1,
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
    version: 1,
    order: [...parsed.data.order],
    hidden: [...parsed.data.hidden],
  };
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
