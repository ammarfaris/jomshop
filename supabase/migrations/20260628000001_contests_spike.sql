-- Phase 0 spike: minimal contests schema + RLS + FTS/trigram.
-- Decisions baked in:
--   * junction tables (not text[]) for hosts/categories
--   * RLS exposes public contests to anon  -> lets us DROP publicContests + its sync fn
--   * Postgres FTS ('simple', shared by EN+MS) + pg_trgm for typo tolerance
-- Source of truth = this file (portable to Cloud + self-host via `supabase` CLI).

create extension if not exists pgcrypto;  -- gen_random_uuid()
create extension if not exists pg_trgm;   -- trigram fuzzy / typo matching

-- ---------------------------------------------------------------------------
-- Reference tables (admin-managed in prod; publicly readable)
-- ---------------------------------------------------------------------------
create table if not exists public.contest_hosts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.contest_categories (
  id             uuid primary key default gen_random_uuid(),
  name_en        text,
  name_ms        text,
  slug           text,
  priority_order int  not null default 0,
  type           text check (type in ('prize', 'winner_selection', 'how_to_enter', 'business_category')),
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Contests
-- ---------------------------------------------------------------------------
create table if not exists public.contests (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,
  title                 text not null,
  title_ms              text,
  summary               text,
  summary_ms            text,
  start_date            timestamptz not null,
  end_date              timestamptz not null,
  main_img_id           text,  -- prod: storage object id; spike: full image URL
  main_img_blurhash     text,
  total_prizes_value_rm double precision,
  visibility            text not null default 'users'
                          check (visibility in ('users', 'admin', 'any')),
  -- Language-agnostic FTS vector. 'simple' is used so EN + MS share one config
  -- and the query side (websearch_to_tsquery('simple', ...)) always matches.
  search tsvector generated always as (
    to_tsvector('simple',
      coalesce(title, '')    || ' ' ||
      coalesce(summary, '')  || ' ' ||
      coalesce(title_ms, '') || ' ' ||
      coalesce(summary_ms, '')
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contests_search_idx        on public.contests using gin (search);
create index if not exists contests_title_trgm_idx     on public.contests using gin (title gin_trgm_ops);
create index if not exists contests_end_date_idx       on public.contests (end_date desc);
create index if not exists contest_hosts_name_trgm_idx on public.contest_hosts using gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Junctions (relational integrity for host_ids / category_ids)
-- ---------------------------------------------------------------------------
create table if not exists public.contest_hosts_map (
  contest_id uuid not null references public.contests(id) on delete cascade,
  host_id    uuid not null references public.contest_hosts(id) on delete cascade,
  primary key (contest_id, host_id)
);

create table if not exists public.contest_categories_map (
  contest_id  uuid not null references public.contests(id) on delete cascade,
  category_id uuid not null references public.contest_categories(id) on delete cascade,
  primary key (contest_id, category_id)
);

create index if not exists contest_hosts_map_contest_idx      on public.contest_hosts_map (contest_id);
create index if not exists contest_categories_map_contest_idx on public.contest_categories_map (contest_id);

-- ---------------------------------------------------------------------------
-- Admin roles (replaces Appwrite team:admin)
-- ---------------------------------------------------------------------------
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role    text not null check (role in ('admin')),
  primary key (user_id, role)
);

-- SECURITY DEFINER so it can read user_roles without recursive RLS evaluation.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS  (proves publicContests + sync function are no longer needed)
-- ---------------------------------------------------------------------------
alter table public.contests               enable row level security;
alter table public.contest_hosts          enable row level security;
alter table public.contest_categories     enable row level security;
alter table public.contest_hosts_map      enable row level security;
alter table public.contest_categories_map enable row level security;
alter table public.user_roles             enable row level security;

-- Anyone (anon + authenticated) can read public-visibility contests.
drop policy if exists "contests_public_read" on public.contests;
create policy "contests_public_read" on public.contests
  for select using (visibility in ('users', 'any'));

-- Admins can read everything, including hidden (visibility = 'admin').
drop policy if exists "contests_admin_read_all" on public.contests;
create policy "contests_admin_read_all" on public.contests
  for select using (public.is_admin());

-- Reference + junction tables are public read (needed to enrich list/search).
drop policy if exists "hosts_read" on public.contest_hosts;
create policy "hosts_read" on public.contest_hosts for select using (true);

drop policy if exists "categories_read" on public.contest_categories;
create policy "categories_read" on public.contest_categories for select using (true);

drop policy if exists "hosts_map_read" on public.contest_hosts_map;
create policy "hosts_map_read" on public.contest_hosts_map for select using (true);

drop policy if exists "categories_map_read" on public.contest_categories_map;
create policy "categories_map_read" on public.contest_categories_map for select using (true);

-- A user can read their own role rows.
drop policy if exists "user_roles_self_read" on public.user_roles;
create policy "user_roles_self_read" on public.user_roles
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Table privileges. RLS only decides WHICH rows are visible; the role still
-- needs table-level SELECT. Supabase's new Data API setup does NOT auto-grant
-- for SQL-created tables, so grant explicitly (also keeps this portable to
-- self-host). anon = public read; user_roles is authenticated-only.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.contests               to anon, authenticated;
grant select on public.contest_hosts          to anon, authenticated;
grant select on public.contest_categories     to anon, authenticated;
grant select on public.contest_hosts_map      to anon, authenticated;
grant select on public.contest_categories_map to anon, authenticated;
grant select on public.user_roles             to authenticated;
