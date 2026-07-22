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

describe('Dashboard widget preferences', () => {
  it('documents the complete default widget order', () => {
    expect(DEFAULT_DASHBOARD_WIDGET_LAYOUT.order).toEqual([
      'performance-summary',
      'winning-trades',
      'winning-days',
      'positions',
      'pnl-workspace',
      'calendar',
    ]);
    expect(DEFAULT_DASHBOARD_WIDGET_LAYOUT.hidden).toEqual([]);
    expect(DEFAULT_DASHBOARD_WIDGET_LAYOUT.version).toBe(DASHBOARD_WIDGET_LAYOUT_VERSION);
  });

  it('rejects incomplete layouts', () => {
    expect(
      dashboardWidgetLayoutSchema.safeParse({
        version: DASHBOARD_WIDGET_LAYOUT_VERSION,
        order: ['performance-summary'],
        hidden: [],
      }).success,
    ).toBe(false);
  });

  it('ignores unknown persisted widgets and falls back to the documented default', () => {
    expect(
      normalizeDashboardWidgetLayout({
        version: DASHBOARD_WIDGET_LAYOUT_VERSION,
        order: [
          'performance-summary',
          'winning-trades',
          'winning-days',
          'positions',
          'pnl-workspace',
          'not-a-widget',
        ],
        hidden: [],
      }),
    ).toEqual(DEFAULT_DASHBOARD_WIDGET_LAYOUT);

    expect(normalizeDashboardWidgetLayout({ hidden: ['not-a-widget'] })).toEqual(
      DEFAULT_DASHBOARD_WIDGET_LAYOUT,
    );
  });

  it('rejects duplicate widgets deterministically', () => {
    const duplicated = normalizeDashboardWidgetLayout({
      version: DASHBOARD_WIDGET_LAYOUT_VERSION,
      order: Array(6).fill('performance-summary'),
      hidden: [],
    });
    expect(duplicated).toEqual(DEFAULT_DASHBOARD_WIDGET_LAYOUT);
    // Repeating the same invalid input always yields the same layout.
    expect(
      normalizeDashboardWidgetLayout({
        version: DASHBOARD_WIDGET_LAYOUT_VERSION,
        order: Array(6).fill('performance-summary'),
        hidden: [],
      }),
    ).toEqual(duplicated);

    expect(
      dashboardWidgetLayoutSchema.safeParse({
        ...DEFAULT_DASHBOARD_WIDGET_LAYOUT,
        hidden: ['calendar', 'calendar'],
      }).success,
    ).toBe(false);
  });

  it('discards a stale layout saved against the previous widget set', () => {
    // Version-1 layouts reference widget ids that no longer exist.
    expect(
      normalizeDashboardWidgetLayout({
        version: 1,
        order: ['net-pnl', 'trade-expectancy', 'profit-factor', 'win-rate', 'trades', 'calendar'],
        hidden: ['net-pnl'],
      }),
    ).toEqual(DEFAULT_DASHBOARD_WIDGET_LAYOUT);
  });

  it('moves only within the established visual region and skips hidden peers', () => {
    const hiddenFirst = {
      ...DEFAULT_DASHBOARD_WIDGET_LAYOUT,
      hidden: ['winning-trades'] as DashboardWidgetId[],
    };
    const moved = moveDashboardWidget(hiddenFirst, 'positions', 'up');
    expect(visibleWidgetIds(moved, 'primary')).toEqual(['positions', 'winning-days']);
    // Already first among visible peers — the same object is returned.
    expect(moveDashboardWidget(moved, 'positions', 'up')).toBe(moved);
    expect(visibleWidgetIds(moved, 'secondary')).toEqual(['pnl-workspace', 'calendar']);
    expect(visibleWidgetIds(moved, 'summary')).toEqual(['performance-summary']);
  });

  it('never reorders a widget into another region', () => {
    // 'calendar' is last in 'secondary'; moving down must be a no-op rather
    // than promoting it into the primary column.
    const layout = DEFAULT_DASHBOARD_WIDGET_LAYOUT;
    expect(moveDashboardWidget(layout, 'calendar', 'down')).toBe(layout);
    expect(moveDashboardWidget(layout, 'performance-summary', 'up')).toBe(layout);
  });

  it('refuses to hide the last visible widget', () => {
    const allButOneHidden = {
      ...DEFAULT_DASHBOARD_WIDGET_LAYOUT,
      hidden: [
        'winning-trades',
        'winning-days',
        'positions',
        'pnl-workspace',
        'calendar',
      ] as DashboardWidgetId[],
    };
    expect(canHideDashboardWidget(allButOneHidden, 'performance-summary')).toBe(false);
    // An already-hidden widget has no Hide action either.
    expect(canHideDashboardWidget(allButOneHidden, 'calendar')).toBe(false);
    expect(canHideDashboardWidget(DEFAULT_DASHBOARD_WIDGET_LAYOUT, 'performance-summary')).toBe(
      true,
    );
  });
});
