import { describe, expect, it } from 'vitest';
import {
  canHideDashboardWidget,
  DASHBOARD_WIDGET_LAYOUT_VERSION,
  DEFAULT_DASHBOARD_WIDGET_LAYOUT,
  dashboardWidgetLayoutSchema,
  moveDashboardWidget,
  normalizeDashboardWidgetLayout,
  visibleWidgetIds,
  type DashboardWidgetId,
} from '@/features/dashboard/widget-preferences';

const ALL_WIDGETS: DashboardWidgetId[] = [
  'net-pnl',
  'trade-expectancy',
  'profit-factor',
  'win-rate',
  'average-win-loss',
  'metatradee-score',
  'cumulative-pnl',
  'daily-pnl',
  'trades',
  'calendar',
];

describe('Dashboard widget preferences', () => {
  it('documents the complete default widget order', () => {
    expect(DEFAULT_DASHBOARD_WIDGET_LAYOUT.order).toEqual(ALL_WIDGETS);
    expect(DEFAULT_DASHBOARD_WIDGET_LAYOUT.hidden).toEqual([]);
    expect(DEFAULT_DASHBOARD_WIDGET_LAYOUT.version).toBe(DASHBOARD_WIDGET_LAYOUT_VERSION);
  });

  it('groups widgets into the five KPI, three analytics, and two lower surfaces', () => {
    expect(visibleWidgetIds(DEFAULT_DASHBOARD_WIDGET_LAYOUT, 'kpi')).toEqual([
      'net-pnl',
      'trade-expectancy',
      'profit-factor',
      'win-rate',
      'average-win-loss',
    ]);
    expect(visibleWidgetIds(DEFAULT_DASHBOARD_WIDGET_LAYOUT, 'analytics')).toEqual([
      'metatradee-score',
      'cumulative-pnl',
      'daily-pnl',
    ]);
    expect(visibleWidgetIds(DEFAULT_DASHBOARD_WIDGET_LAYOUT, 'lower')).toEqual([
      'trades',
      'calendar',
    ]);
  });

  it('rejects incomplete layouts', () => {
    expect(
      dashboardWidgetLayoutSchema.safeParse({
        version: DASHBOARD_WIDGET_LAYOUT_VERSION,
        order: ['net-pnl'],
        hidden: [],
      }).success,
    ).toBe(false);
  });

  it('ignores unknown persisted widgets and falls back to the documented default', () => {
    expect(
      normalizeDashboardWidgetLayout({
        version: DASHBOARD_WIDGET_LAYOUT_VERSION,
        order: [...ALL_WIDGETS.slice(0, 9), 'not-a-widget'],
        hidden: [],
      }),
    ).toEqual(DEFAULT_DASHBOARD_WIDGET_LAYOUT);

    expect(normalizeDashboardWidgetLayout({ hidden: ['not-a-widget'] })).toEqual(
      DEFAULT_DASHBOARD_WIDGET_LAYOUT,
    );
  });

  it('rejects duplicate widgets deterministically', () => {
    const input = {
      version: DASHBOARD_WIDGET_LAYOUT_VERSION,
      order: Array(10).fill('net-pnl'),
      hidden: [],
    };
    expect(normalizeDashboardWidgetLayout(input)).toEqual(DEFAULT_DASHBOARD_WIDGET_LAYOUT);
    // The same invalid input always yields the same layout.
    expect(normalizeDashboardWidgetLayout(input)).toEqual(normalizeDashboardWidgetLayout(input));

    expect(
      dashboardWidgetLayoutSchema.safeParse({
        ...DEFAULT_DASHBOARD_WIDGET_LAYOUT,
        hidden: ['calendar', 'calendar'],
      }).success,
    ).toBe(false);
  });

  it('discards a stale layout saved against a previous widget set', () => {
    expect(
      normalizeDashboardWidgetLayout({
        version: 2,
        order: [
          'performance-summary',
          'winning-trades',
          'winning-days',
          'positions',
          'pnl-workspace',
          'calendar',
        ],
        hidden: ['positions'],
      }),
    ).toEqual(DEFAULT_DASHBOARD_WIDGET_LAYOUT);
  });

  it('moves only within the established visual region and skips hidden peers', () => {
    const hiddenFirst = {
      ...DEFAULT_DASHBOARD_WIDGET_LAYOUT,
      hidden: ['net-pnl'] as DashboardWidgetId[],
    };
    const moved = moveDashboardWidget(hiddenFirst, 'profit-factor', 'up');
    expect(visibleWidgetIds(moved, 'kpi').slice(0, 2)).toEqual([
      'profit-factor',
      'trade-expectancy',
    ]);
    // Already first among visible peers — the same object is returned.
    expect(moveDashboardWidget(moved, 'profit-factor', 'up')).toBe(moved);
    expect(visibleWidgetIds(moved, 'analytics')).toEqual([
      'metatradee-score',
      'cumulative-pnl',
      'daily-pnl',
    ]);
  });

  it('never reorders a widget into another region', () => {
    const layout = DEFAULT_DASHBOARD_WIDGET_LAYOUT;
    // Last of 'kpi' cannot fall into 'analytics'.
    expect(moveDashboardWidget(layout, 'average-win-loss', 'down')).toBe(layout);
    // First of 'analytics' cannot rise into 'kpi'.
    expect(moveDashboardWidget(layout, 'metatradee-score', 'up')).toBe(layout);
    expect(moveDashboardWidget(layout, 'calendar', 'down')).toBe(layout);
  });

  it('refuses to hide the last visible widget', () => {
    const allButOneHidden = {
      ...DEFAULT_DASHBOARD_WIDGET_LAYOUT,
      hidden: ALL_WIDGETS.filter((id) => id !== 'net-pnl'),
    };
    expect(canHideDashboardWidget(allButOneHidden, 'net-pnl')).toBe(false);
    // An already-hidden widget has no Hide action either.
    expect(canHideDashboardWidget(allButOneHidden, 'calendar')).toBe(false);
    expect(canHideDashboardWidget(DEFAULT_DASHBOARD_WIDGET_LAYOUT, 'net-pnl')).toBe(true);
  });
});
