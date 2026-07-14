/**
 * First-login workspace provisioning (server-only). Idempotently ensures the
 * signed-in user's starter tags + default strategy exist by calling the
 * security-definer `ensure_workspace_defaults` RPC. The RPC keys off auth.uid(),
 * so it can only ever provision the caller's own workspace.
 *
 * Safe to call on every entry; the DB unique indexes make repeats no-ops. The
 * 9.2 signup trigger already calls the same routine — this covers pre-existing
 * users and is the app-side entry point.
 */
import { createClient } from '@/lib/supabase/server';

export async function ensureWorkspaceDefaults(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase.rpc('ensure_workspace_defaults', {
    p_user_id: user.id,
  });
  return { ok: !error };
}
