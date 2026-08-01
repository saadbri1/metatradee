-- Rollback for 20260801120000_paypal_one_time_payments.
--
-- DESTRUCTIVE: dropping this table destroys the record of what buyers actually
-- paid, and with it every access window. Never run against an environment that
-- has taken real money. Preview only.
drop policy if exists "paypal_payments_select_own" on public.paypal_payments;
drop trigger if exists set_paypal_payments_updated_at on public.paypal_payments;
drop index if exists public.paypal_payments_completed_order_uniq;
drop index if exists public.paypal_payments_order_idx;
drop index if exists public.paypal_payments_user_idx;
drop table if exists public.paypal_payments;
