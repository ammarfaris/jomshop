-- Premium content gating at the DB layer (defense-in-depth).
--
-- The client only *requests* affiliate links + premium translation fields when a
-- user is authenticated (see lib/supabase/contests.ts CONTEST_PREMIUM_COLS /
-- TRANSLATION_PREMIUM_COLS). But the anon key ships in the app bundle, so a
-- hand-crafted PostgREST query could otherwise read those columns directly.
-- Postgres RLS is row-level only, so we gate the columns with column-level
-- privileges: drop anon's table-wide SELECT and re-grant SELECT on every column
-- EXCEPT the premium ones. `authenticated` keeps its full table SELECT.
--
-- NOTE: anon's grant is enumerated from the current columns. A future column
-- added to these tables won't be readable by anon until it's added here too
-- (fail-closed for anon, which is the safe default for new fields).

do $$
declare
  cols text;
begin
  -- contests: hide affiliate links from anon.
  select string_agg(format('%I', column_name), ', ')
    into cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'contests'
    and column_name not in (
      'link_aff_shopee',
      'link_aff_lazada',
      'link_aff_tiktok_shop'
    );

  revoke select on public.contests from anon;
  execute format('grant select (%s) on public.contests to anon', cols);

  -- contest_translations: hide winner mechanics + T&C / FAQ links from anon.
  select string_agg(format('%I', column_name), ', ')
    into cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'contest_translations'
    and column_name not in (
      'winners_selection_method',
      'winners_comm_and_timeline',
      'winners_list_and_announcement',
      'link_tnc',
      'link_faq'
    );

  revoke select on public.contest_translations from anon;
  execute format('grant select (%s) on public.contest_translations to anon', cols);
end $$;

-- search_contests reads `ct.*` internally (to thread columns through its CTEs) and
-- was SECURITY INVOKER, so as anon it would now hit the revoked premium columns
-- and error. It only RETURNS an explicit, premium-free jsonb shape and already
-- filters `visibility in ('users','any')` in-query, so make it SECURITY DEFINER:
-- it can read all columns to compute results while still exposing only safe fields.
alter function public.search_contests(text, text[], text[], text[], int, int)
  security definer;
