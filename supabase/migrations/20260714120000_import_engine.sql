-- ============================================================================
-- Migration: import_engine (Phase 10.8 — Broker Integrations & Trade Import Hub)
--
-- ADDITIVE. Imported trades are written by the JOURNAL's trade service into the
-- existing `trades` table (source='imported', import_id, content_hash) — there
-- is NO second trades table and NO second math path. These tables track the
-- import JOB (status, counts, resumable checkpoint), a STAGING row per parsed
-- line (auditability, retry, error reports), and saved mapping templates.
--
-- Idempotency: `trades.content_hash` (journal rule, indexed since 10.1) is the
-- dedupe key — a retried batch finds its hashes already present and skips.
-- Also adds the trades.import_id FK the journal migration deferred to us.
--
-- Idempotent + reversible (paired *.down.sql). Reuses set_updated_at.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- imports — one row per import job. `checkpoint` is the last confirmed row
-- index: resuming continues after it; combined with content-hash dedupe a
-- resumed/retried import can never double-insert.
-- ---------------------------------------------------------------------------
create table if not exists public.imports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  adapter     text not null,
  method      text not null default 'file' check (method in ('file')),
  file_name   text,
  status      text not null default 'previewing'
              check (status in ('previewing','importing','completed','failed','cancelled','rolled_back')),
  total_rows     integer not null default 0,
  imported_rows  integer not null default 0,
  duplicate_rows integer not null default 0,
  failed_rows    integer not null default 0,
  skipped_rows   integer not null default 0,
  -- Resumable checkpoint: highest source-row index confirmed processed.
  checkpoint  integer not null default -1,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists imports_user_idx on public.imports (user_id, created_at desc);

drop trigger if exists set_imports_updated_at on public.imports;
create trigger set_imports_updated_at before update on public.imports
  for each row execute function public.set_updated_at();

alter table public.imports enable row level security;
drop policy if exists "imports_all_own" on public.imports;
create policy "imports_all_own" on public.imports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- import_rows — staging/audit: one row per source line with its outcome and a
-- link to the created trade. Enables per-row retry and downloadable error
-- reports without re-importing successful rows. Retention: rows may be pruned
-- after 90 days (documented; no automatic destructive job in this phase).
-- unique(import_id,row_index) makes row recording idempotent under retry.
-- ---------------------------------------------------------------------------
create table if not exists public.import_rows (
  id           uuid primary key default gen_random_uuid(),
  import_id    uuid not null references public.imports (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  row_index    integer not null,
  content_hash text,
  status       text not null check (status in ('imported','duplicate','invalid','failed','skipped')),
  errors       jsonb not null default '[]'::jsonb,
  trade_id     uuid references public.trades (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (import_id, row_index)
);
create index if not exists import_rows_import_idx on public.import_rows (import_id);
create index if not exists import_rows_user_idx on public.import_rows (user_id);

alter table public.import_rows enable row level security;
drop policy if exists "import_rows_all_own" on public.import_rows;
create policy "import_rows_all_own" on public.import_rows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- mapping_templates — saved column mappings per user/adapter.
-- ---------------------------------------------------------------------------
create table if not exists public.mapping_templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  adapter    text not null,
  name       text not null,
  mapping    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, adapter, name),
  constraint mapping_templates_name_len check (char_length(name) between 1 and 60)
);
create index if not exists mapping_templates_user_idx on public.mapping_templates (user_id);

drop trigger if exists set_mapping_templates_updated_at on public.mapping_templates;
create trigger set_mapping_templates_updated_at before update on public.mapping_templates
  for each row execute function public.set_updated_at();

alter table public.mapping_templates enable row level security;
drop policy if exists "mapping_templates_all_own" on public.mapping_templates;
create policy "mapping_templates_all_own" on public.mapping_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- The trades.import_id FK the journal migration (10.1) deferred to this phase.
-- ON DELETE SET NULL: deleting an import job never deletes the user's trades.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trades_import_id_fkey') then
    alter table public.trades
      add constraint trades_import_id_fkey
      foreign key (import_id) references public.imports (id) on delete set null;
  end if;
end $$;

create index if not exists trades_import_id_idx on public.trades (import_id);
