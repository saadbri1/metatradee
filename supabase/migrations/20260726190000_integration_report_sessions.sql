-- ============================================================================
-- Migration: integration_report_sessions
--
-- Durable state for asynchronous broker report generation (IBKR Flex Phase 1).
--
-- WHY: a Flex report is requested ONCE and then polled. Holding the pending
-- ReferenceCode in process memory does not survive a serverless cold start, and
-- is not shared between concurrent instances — so each instance re-requested a
-- new report. This table makes the pending reference the single durable fact.
--
-- SECURITY
-- - NO SECRET IS STORED. The Flex token is never written here; the row is keyed
--   by a salted SHA-256 fingerprint of it, which is one-way.
-- - RLS is enabled with NO policies, so the anon and authenticated keys can
--   read nothing. Access is service-role only (server-side), which is correct:
--   this is infrastructure state, not user data.
--
-- Additive and reversible (paired *.down.sql).
-- ============================================================================

create table if not exists public.integration_report_sessions (
  id                       uuid primary key default gen_random_uuid(),

  -- Which integration this session belongs to, e.g. 'ibkr-flex'.
  provider                 text not null,

  -- Salted SHA-256 of the credential. NEVER the credential itself.
  credential_fingerprint   text not null,
  -- Salted SHA-256 of the query id, so one credential may run several queries
  -- independently while each keeps a single active report.
  query_fingerprint        text not null,

  -- The provider's report handle. Null while a request has been made but the
  -- provider has not yet issued one.
  reference_code           text,

  status                   text not null default 'pending'
                           check (status in ('pending', 'ready', 'failed', 'timeout')),

  attempts                 integer not null default 0,

  created_at               timestamptz not null default now(),
  last_checked_at          timestamptz,
  -- No provider request may be made for this session before this moment.
  next_allowed_check_at    timestamptz not null default now(),
  -- After this, the session is abandoned rather than polled forever.
  expires_at               timestamptz not null,

  -- Safe category only (e.g. 'expired_token'), never provider text.
  terminal_error_category  text,

  updated_at               timestamptz not null default now(),

  constraint integration_report_sessions_fingerprint_len
    check (char_length(credential_fingerprint) between 16 and 128),
  constraint integration_report_sessions_provider_len
    check (char_length(provider) between 1 and 64)
);

-- ONE active report per provider + credential + query. This is the constraint
-- that makes "do not issue another SendRequest while one is pending" a database
-- guarantee rather than an application convention.
create unique index if not exists integration_report_sessions_active_uniq
  on public.integration_report_sessions (provider, credential_fingerprint, query_fingerprint)
  where status = 'pending';

create index if not exists integration_report_sessions_lookup_idx
  on public.integration_report_sessions (provider, credential_fingerprint, query_fingerprint, created_at desc);

drop trigger if exists set_integration_report_sessions_updated_at
  on public.integration_report_sessions;
create trigger set_integration_report_sessions_updated_at
  before update on public.integration_report_sessions
  for each row execute function public.set_updated_at();

-- RLS on, deliberately with NO policies: unreachable from the anon and
-- authenticated keys. Server-side service-role access only.
alter table public.integration_report_sessions enable row level security;

comment on table public.integration_report_sessions is
  'Durable pending-report state for broker integrations. Holds no secrets — credentials are referenced by salted fingerprint only. Service-role access only (RLS enabled, no policies).';
