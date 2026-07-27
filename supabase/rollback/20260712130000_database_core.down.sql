-- ============================================================================
-- Rollback for: 20260712130000_database_core.sql
--
-- Restores handle_new_user to its 9.2 (pre-9.3) body, drops the provisioning
-- helper, then drops the four core tables (cascade removes their policies,
-- triggers, indexes). The pgcrypto extension is intentionally LEFT in place.
--
-- Safe to re-run (IF EXISTS everywhere). WARNING: dropping the tables
-- permanently deletes strategies/tags/attachments/trading-account data.
-- ============================================================================

-- Restore the 9.2 handle_new_user (without the workspace-defaults call).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, is_verified)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email_confirmed_at is not null
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;

  return new;
end;
$$;

drop function if exists public.ensure_workspace_defaults(uuid);

drop table if exists public.attachments cascade;
drop table if exists public.tags cascade;
drop table if exists public.strategies cascade;
drop table if exists public.trading_accounts cascade;

-- Intentionally NOT dropped: extension "pgcrypto".
