'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { TABLES } from '@/lib/db/tables';
import type { ActionResult } from '@/features/workspace/types';
import { dashboardWidgetLayoutSchema } from '../widget-preferences';

const GENERIC_ERROR = 'Dashboard preferences could not be saved. Please try again.';

export async function saveDashboardWidgetLayoutAction(input: unknown): Promise<ActionResult> {
  const parsed = dashboardWidgetLayoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'The widget layout is invalid.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { data: preferenceRow, error: readError } = await supabase
    .from(TABLES.userPreferences)
    .select('dashboard_preferences')
    .eq('user_id', user.id)
    .maybeSingle();
  if (readError) return { ok: false, error: GENERIC_ERROR };

  const current = preferenceRow?.dashboard_preferences;
  const dashboardPreferences =
    current && typeof current === 'object' && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};

  const { error } = await supabase.from(TABLES.userPreferences).upsert(
    {
      user_id: user.id,
      dashboard_preferences: {
        ...dashboardPreferences,
        widgets: parsed.data,
      },
    },
    { onConflict: 'user_id' },
  );
  if (error) return { ok: false, error: GENERIC_ERROR };

  revalidatePath('/dashboard');
  return { ok: true };
}
