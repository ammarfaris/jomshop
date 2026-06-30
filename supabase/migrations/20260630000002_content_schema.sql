-- Phase 1: full content model. Extends the Phase-0 spike (contests / hosts /
-- categories) with the columns + child tables the real app reads:
--   * host logos                  -> contest_hosts.img_id
--   * social / affiliate links    -> contests.link_*
--   * upvote counter (denorm)     -> contests.upvote_count (kept current by trigger)
--   * gallery images              -> contest_files
--   * rich localized detail copy  -> contest_translations
-- Column names mirror createContestSchema.ts so the client mapping stays 1:1.

-- ---------------------------------------------------------------------------
-- Hosts: logo + slug + bio
-- ---------------------------------------------------------------------------
alter table public.contest_hosts
  add column if not exists slug         text,
  add column if not exists img_id       text, -- storage public URL or object path (contest-hosts bucket)
  add column if not exists img_blurhash text,
  add column if not exists bio          text;

-- ---------------------------------------------------------------------------
-- Contests: denormalized upvote counter + social / affiliate links
-- ---------------------------------------------------------------------------
alter table public.contests
  add column if not exists upvote_count         int not null default 0,
  add column if not exists link_aff_shopee      text,
  add column if not exists link_aff_lazada      text,
  add column if not exists link_aff_tiktok_shop text,
  add column if not exists link_media_instagram text,
  add column if not exists link_media_facebook  text,
  add column if not exists link_media_tiktok    text,
  add column if not exists link_media_x         text,
  add column if not exists link_media_youtube   text,
  add column if not exists link_media_linkedin  text,
  add column if not exists link_media_website   text;

drop trigger if exists contests_set_updated_at on public.contests;
create trigger contests_set_updated_at
  before update on public.contests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Gallery images (1 contest -> many files)
-- ---------------------------------------------------------------------------
create table if not exists public.contest_files (
  id           uuid primary key default gen_random_uuid(),
  contest_id   uuid not null references public.contests(id) on delete cascade,
  storage_path text not null,            -- object path in the 'contests' bucket
  width        int,
  height       int,
  label        text,
  file_order   int not null default 0,
  blurhash     text,
  created_at   timestamptz not null default now()
);
create index if not exists contest_files_contest_idx
  on public.contest_files (contest_id, file_order);

-- ---------------------------------------------------------------------------
-- Localized rich detail copy (1 contest -> 1 row per locale). Column stems
-- match createContestSchema.ts (minus the _en/_ms suffix).
-- ---------------------------------------------------------------------------
create table if not exists public.contest_translations (
  id                              uuid primary key default gen_random_uuid(),
  contest_id                      uuid not null references public.contests(id) on delete cascade,
  locale                          text not null check (locale in ('en', 'ms')),
  prizes                          text,
  link_tnc                        text,
  link_faq                        text,
  eligible_products               text,
  eligible_participants           text,
  eligible_participants_exclusion text,
  eligible_stores                 text,
  winners_selection_method        text,
  entry_method                    text,
  winners_list_and_announcement   text,
  winners_comm_and_timeline       text,
  created_at                      timestamptz not null default now(),
  unique (contest_id, locale)
);
create index if not exists contest_translations_contest_idx
  on public.contest_translations (contest_id);

-- ---------------------------------------------------------------------------
-- RLS: child rows are readable when their parent contest is publicly visible
-- (or the caller is an admin). Mirrors contests_public_read / admin_read_all.
-- ---------------------------------------------------------------------------
alter table public.contest_files        enable row level security;
alter table public.contest_translations enable row level security;

drop policy if exists "contest_files_public_read" on public.contest_files;
create policy "contest_files_public_read" on public.contest_files
  for select using (
    exists (
      select 1 from public.contests c
      where c.id = contest_id and c.visibility in ('users', 'any')
    )
    or public.is_admin()
  );

drop policy if exists "contest_translations_public_read" on public.contest_translations;
create policy "contest_translations_public_read" on public.contest_translations
  for select using (
    exists (
      select 1 from public.contests c
      where c.id = contest_id and c.visibility in ('users', 'any')
    )
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- Admin writes for all content tables (RLS gates rows; grants below allow the
-- statement). Reads are already public via the spike + the policies above.
-- ---------------------------------------------------------------------------
drop policy if exists "contests_admin_write" on public.contests;
create policy "contests_admin_write" on public.contests
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "hosts_admin_write" on public.contest_hosts;
create policy "hosts_admin_write" on public.contest_hosts
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "categories_admin_write" on public.contest_categories;
create policy "categories_admin_write" on public.contest_categories
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "hosts_map_admin_write" on public.contest_hosts_map;
create policy "hosts_map_admin_write" on public.contest_hosts_map
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "categories_map_admin_write" on public.contest_categories_map;
create policy "categories_map_admin_write" on public.contest_categories_map
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "contest_files_admin_write" on public.contest_files;
create policy "contest_files_admin_write" on public.contest_files
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "contest_translations_admin_write" on public.contest_translations;
create policy "contest_translations_admin_write" on public.contest_translations
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants. Public read for content; writes are authenticated (RLS -> admins).
-- ---------------------------------------------------------------------------
grant select on public.contest_files        to anon, authenticated;
-- contest_translations has premium columns (winner mechanics, T&C / FAQ links).
-- authenticated reads the whole row; anon gets a COLUMN-SCOPED grant (premium
-- columns excluded) in 20260630000006_premium_grants.sql.
grant select on public.contest_translations to authenticated;

grant insert, update, delete on public.contests               to authenticated;
grant insert, update, delete on public.contest_hosts          to authenticated;
grant insert, update, delete on public.contest_categories     to authenticated;
grant insert, update, delete on public.contest_hosts_map      to authenticated;
grant insert, update, delete on public.contest_categories_map to authenticated;
grant insert, update, delete on public.contest_files          to authenticated;
grant insert, update, delete on public.contest_translations   to authenticated;
