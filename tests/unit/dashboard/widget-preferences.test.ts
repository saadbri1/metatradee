import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DASHBOARD_WIDGET_LAYOUT,
  dashboardWidgetLayoutSchema,
  moveDashboardWidget,
  normalizeDashboardWidgetLayout,
  visibleWidgetIds,
  type DashboardWidgetId,
} from '@/features/dashboard/widget-preferences';

describe('Dashboard widget preferences', () => {
  it('documents the complete default widget order', () => {
    expect(DEFAULT_DASHBOARD_WIDGET_LAYOUT.order).toEqual([
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
    ]);
    expect(DEFAULT_DASHBOARD_WIDGET_LAYOUT.hidden).toEqual([]);
  });

  it('rejects incomplete, duplicate, and unknown persisted layouts', () => {
    expect(
      dashboardWidgetLayoutSchema.safeParse({
        version: 1,
        order: ['net-pnl'],
        hidden: [],
      }).success,
    ).toBe(false);
    expect(
      normalizeDashboardWidgetLayout({
        version: 1,
        order: Array(10).fill('net-pnl'),
        hidden: ['not-a-widget'],
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
    expect(moveDashboardWidget(moved, 'profit-factor', 'up')).toBe(moved);
    expect(visibleWidgetIds(moved, 'analytics')).toEqual([
      'metatradee-score',
      'cumulative-pnl',
      'daily-pnl',
    ]);
  });
});
