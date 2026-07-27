-- ============================================================================
-- Rollback for: 20260713160000_billing.sql
-- Drops billing mirror tables in dependency-safe order. Safe to re-run.
-- WARNING: destroys mirrored subscription/invoice state + webhook audit trail.
-- (Provider remains the source of truth; state can be re-mirrored from webhooks.)
-- ============================================================================

drop table if exists public.billing_audit cascade;
drop table if exists public.billing_coupons cascade;
drop table if exists public.billing_events cascade;
drop table if exists public.billing_invoices cascade;
drop table if exists public.billing_subscriptions cascade;
drop table if exists public.billing_customers cascade;
