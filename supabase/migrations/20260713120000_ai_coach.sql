-- ============================================================================
-- Migration: ai_coach (Phase 9.12 — AI Coach & Trade Review Engine)
--
-- Stores generated reviews, per-insight feedback, and an APPEND-ONLY audit of
-- every AI request (who / when / scope / provider / model / token cost). The AI
-- computes NO trade math — reviews only cache evidence-grounded narrative +
-- engine-supplied figures. All tables are RLS owner-scoped; no cross-user access.
--
-- Idempotent + reversible (paired *.down.sql). Reuses set_updated_at.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ai_reviews — one current review per (scope, target). Regeneration replaces it
-- via upsert. `insights` holds the CoachInsight[] (narrative + evidence +
-- confidence + referenced trade ids + detected patterns). Numbers inside are
-- engine-computed, never model-authored.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  scope         text not null check (scope in ('trade','daily','weekly','monthly')),
  -- Trade uuid (trade scope) or an ISO date/period key (daily/weekly/monthly).
  target_id     text not null,
  insights      jsonb not null default '[]'::jsonb,
  provider      text not null,
  model         text not null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  -- True when produced by the deterministic mock (no live model configured).
  is_mock       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, scope, target_id)
);

create index if not exists ai_reviews_user_scope_idx
  on public.ai_reviews (user_id, scope, created_at desc);

create trigger set_ai_reviews_updated_at before update on public.ai_reviews
  for each row execute function public.set_updated_at();

alter table public.ai_reviews enable row level security;

create policy "ai_reviews_all_own" on public.ai_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- ai_feedback — accepted vs dismissed advice, per insight. Feeds longitudinal
-- prioritization (the coach's memory of what the user found useful).
-- ---------------------------------------------------------------------------
create table if not exists public.ai_feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  review_id  uuid not null references public.ai_reviews (id) on delete cascade,
  insight_id text not null,
  verdict    text not null check (verdict in ('accepted','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, review_id, insight_id)
);

create index if not exists ai_feedback_user_idx on public.ai_feedback (user_id, created_at desc);

create trigger set_ai_feedback_updated_at before update on public.ai_feedback
  for each row execute function public.set_updated_at();

alter table public.ai_feedback enable row level security;

create policy "ai_feedback_all_own" on public.ai_feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- ai_requests — APPEND-ONLY audit of every model call. Cost observability +
-- abuse detection (NOT user rationing). Owner can read own rows; insert own
-- rows; no update/delete policy (immutable trail).
-- ---------------------------------------------------------------------------
create table if not exists public.ai_requests (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  scope         text not null,
  -- Human description of the data that fed the prompt, e.g. 'own:trades+journal'.
  data_scope    text not null default 'own',
  provider      text not null,
  model         text not null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists ai_requests_user_created_idx
  on public.ai_requests (user_id, created_at desc);

alter table public.ai_requests enable row level security;

create policy "ai_requests_select_own" on public.ai_requests
  for select using (auth.uid() = user_id);

create policy "ai_requests_insert_own" on public.ai_requests
  for insert with check (auth.uid() = user_id);

comment on table public.ai_requests is
  'Append-only AI audit trail (scope, provider, model, token cost). Owner read/insert only; no update/delete.';
