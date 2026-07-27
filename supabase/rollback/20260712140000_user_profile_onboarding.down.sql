-- ============================================================================
-- Rollback for: 20260712140000_user_profile_onboarding.sql
--
-- Drops trading_profiles, then removes the columns/constraints added to
-- user_preferences and profiles. Safe to re-run (IF EXISTS). WARNING: dropping
-- columns/table permanently deletes profile-detail, preferences, and
-- trading-profile data.
-- ============================================================================

drop table if exists public.trading_profiles cascade;

alter table public.user_preferences drop constraint if exists user_preferences_time_format_chk;
alter table public.user_preferences drop constraint if exists user_preferences_risk_unit_chk;
alter table public.user_preferences drop constraint if exists user_preferences_currency_chk;
alter table public.user_preferences drop constraint if exists user_preferences_font_scale_range;
alter table public.user_preferences drop column if exists accessibility_preferences;
alter table public.user_preferences drop column if exists dashboard_preferences;
alter table public.user_preferences drop column if exists notification_preferences;
alter table public.user_preferences drop column if exists chart_preferences;
alter table public.user_preferences drop column if exists auto_save;
alter table public.user_preferences drop column if exists font_scale;
alter table public.user_preferences drop column if exists risk_unit;
alter table public.user_preferences drop column if exists time_format;
alter table public.user_preferences drop column if exists date_format;
alter table public.user_preferences drop column if exists currency;

alter table public.profiles drop constraint if exists profiles_bio_len;
alter table public.profiles drop constraint if exists profiles_country_code;
alter table public.profiles drop constraint if exists profiles_onboarding_step_range;
alter table public.profiles drop column if exists onboarding_completed_at;
alter table public.profiles drop column if exists onboarding_completed;
alter table public.profiles drop column if exists onboarding_step;
alter table public.profiles drop column if exists preferred_language;
alter table public.profiles drop column if exists timezone;
alter table public.profiles drop column if exists country;
alter table public.profiles drop column if exists bio;
