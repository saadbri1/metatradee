-- ============================================================================
-- Rollback for: 20260712180000_playbook.sql
-- Drops new tables + the added strategies columns/constraint. Preserves the
-- original 9.3 strategies columns and the trades.strategy_id link. Safe to re-run.
-- WARNING: destroys playbook/version/template/adherence data.
-- ============================================================================

drop table if exists public.trade_strategy_adherence cascade;
drop table if exists public.strategy_templates cascade;
drop table if exists public.strategy_versions cascade;
drop table if exists public.playbook_strategies cascade;
drop table if exists public.playbooks cascade;

alter table public.strategies drop constraint if exists strategies_status_chk;
alter table public.strategies drop column if exists is_pinned;
alter table public.strategies drop column if exists current_version;
alter table public.strategies drop column if exists status;
alter table public.strategies drop column if exists notes;
alter table public.strategies drop column if exists checklist;
alter table public.strategies drop column if exists invalidation_rules;
alter table public.strategies drop column if exists confirmation_rules;
alter table public.strategies drop column if exists risk_rules;
alter table public.strategies drop column if exists position_sizing_rules;
alter table public.strategies drop column if exists take_profit_rules;
alter table public.strategies drop column if exists stop_loss_rules;
alter table public.strategies drop column if exists exit_rules;
alter table public.strategies drop column if exists entry_rules;
alter table public.strategies drop column if exists sessions;
alter table public.strategies drop column if exists timeframes;
alter table public.strategies drop column if exists symbols;
alter table public.strategies drop column if exists asset_class;
alter table public.strategies drop column if exists market;
alter table public.strategies drop column if exists category;
