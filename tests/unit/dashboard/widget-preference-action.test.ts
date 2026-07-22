import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DASHBOARD_WIDGET_LAYOUT } from '@/features/dashboard/widget-preferences';

const state = vi.hoisted(() => ({
  user: { id: 'dashboard-user' } as { id: string } | null,
  existing: {
    dashboard_preferences: { compact_tables: true },
  } as { dashboard_preferences: Record<string, unknown> } | null,
  readError: null as unknown,
  writeError: null as unknown,
  upsert: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => ({ data: state.existing, error: state.readError })),
      upsert: state.upsert.mockImplementation(async () => ({ error: state.writeError })),
    };
    return {
      auth: { getUser: vi.fn(async () => ({ data: { user: state.user } })) },
      from: vi.fn(() => builder),
    };
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: state.revalidate }));

import { saveDashboardWidgetLayoutAction } from '@/features/dashboard/server/actions';

describe('saveDashboardWidgetLayoutAction', () => {
  beforeEach(() => {
    state.user = { id: 'dashboard-user' };
    state.existing = { dashboard_preferences: { compact_tables: true } };
    state.readError = null;
    state.writeError = null;
    state.upsert.mockClear();
    state.revalidate.mockClear();
  });

  it('saves the versioned layout for the authenticated user without replacing other preferences', async () => {
    const layout = {
      ...DEFAULT_DASHBOARD_WIDGET_LAYOUT,
      hidden: ['calendar'] as const,
    };
    const result = await saveDashboardWidgetLayoutAction(layout);

    expect(result).toEqual({ ok: true });
    expect(state.upsert).toHaveBeenCalledWith(
      {
        user_id: 'dashboard-user',
        dashboard_preferences: {
          compact_tables: true,
          widgets: layout,
        },
      },
      { onConflict: 'user_id' },
    );
    expect(state.revalidate).toHaveBeenCalledWith('/dashboard');
  });

  it('rejects unauthenticated and malformed writes', async () => {
    expect(await saveDashboardWidgetLayoutAction({ order: [] })).toEqual({
      ok: false,
      error: 'The widget layout is invalid.',
    });
    state.user = null;
    expect(await saveDashboardWidgetLayoutAction(DEFAULT_DASHBOARD_WIDGET_LAYOUT)).toEqual({
      ok: false,
      error: 'You must be signed in.',
    });
    expect(state.upsert).not.toHaveBeenCalled();
  });
});
