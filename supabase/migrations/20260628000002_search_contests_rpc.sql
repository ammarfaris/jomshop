-- Phase 0 spike: search_contests RPC (Postgres FTS + pg_trgm).
-- Returns a Meilisearch-compatible JSON shape so the existing client
-- `searchContests()` contract (hits / estimatedTotalHits / facetDistribution)
-- is unchanged. Filters/facets use NAMES (host_names, category_names_en/ms)
-- to match the current search screen exactly.
--
-- SECURITY INVOKER -> the caller's RLS applies (anon only sees public contests).

create or replace function public.search_contests(
  q                        text   default '',
  filter_host_names        text[] default null,
  filter_category_names_en text[] default null,
  filter_category_names_ms text[] default null,
  lim                      int    default 20,
  off                      int    default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with c as (
    select
      ct.*,
      coalesce(array_agg(distinct h.name)    filter (where h.name    is not null), '{}') as host_names,
      coalesce(array_agg(distinct k.name_en) filter (where k.name_en is not null), '{}') as category_names_en,
      coalesce(array_agg(distinct k.name_ms) filter (where k.name_ms is not null), '{}') as category_names_ms
    from public.contests ct
    left join public.contest_hosts_map      hm on hm.contest_id = ct.id
    left join public.contest_hosts          h  on h.id  = hm.host_id
    left join public.contest_categories_map km on km.contest_id = ct.id
    left join public.contest_categories     k  on k.id  = km.category_id
    where ct.visibility in ('users', 'any')
    group by ct.id
  ),
  tq as (
    select case
      when length(coalesce(trim(q), '')) > 0
      then websearch_to_tsquery('simple', q)
    end as ts
  ),
  filtered as (
    select
      c.*,
      case when (select ts from tq) is null then 0
           else ts_rank(c.search, (select ts from tq)) end as rank
    from c
    where
      (
        (select ts from tq) is null
        or c.search @@ (select ts from tq)
        or c.title ilike '%' || q || '%'
        or c.title % q
        or exists (select 1 from unnest(c.host_names)        hn where hn ilike '%' || q || '%' or hn % q)
        or exists (select 1 from unnest(c.category_names_en) cn where cn ilike '%' || q || '%')
        or exists (select 1 from unnest(c.category_names_ms) cn where cn ilike '%' || q || '%')
      )
      and (filter_host_names        is null or c.host_names        && filter_host_names)
      and (filter_category_names_en is null or c.category_names_en && filter_category_names_en)
      and (filter_category_names_ms is null or c.category_names_ms && filter_category_names_ms)
  ),
  page as (
    select * from filtered
    order by rank desc, end_date desc
    offset greatest(off, 0)
    limit greatest(lim, 0)
  )
  select jsonb_build_object(
    'query', q,
    'limit', lim,
    'offset', off,
    'estimatedTotalHits', (select count(*) from filtered),
    'hits', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',                p.id,
        '$id',               p.id,
        'slug',              p.slug,
        'title',             p.title,
        'title_ms',          p.title_ms,
        'summary',           p.summary,
        'summary_ms',        p.summary_ms,
        'start_date',        p.start_date,
        'end_date',          p.end_date,
        'preview_img',       p.main_img_id,
        'main_img_blurhash', p.main_img_blurhash,
        'host_names',        to_jsonb(p.host_names),
        'category_names_en', to_jsonb(p.category_names_en),
        'category_names_ms', to_jsonb(p.category_names_ms)
      )) from page p
    ), '[]'::jsonb),
    'facetDistribution', jsonb_build_object(
      'host_names', coalesce((
        select jsonb_object_agg(name, cnt) from (
          select hn as name, count(*) as cnt
          from filtered f, unnest(f.host_names) hn group by hn
        ) s
      ), '{}'::jsonb),
      'category_names_en', coalesce((
        select jsonb_object_agg(name, cnt) from (
          select cn as name, count(*) as cnt
          from filtered f, unnest(f.category_names_en) cn group by cn
        ) s
      ), '{}'::jsonb),
      'category_names_ms', coalesce((
        select jsonb_object_agg(name, cnt) from (
          select cn as name, count(*) as cnt
          from filtered f, unnest(f.category_names_ms) cn group by cn
        ) s
      ), '{}'::jsonb)
    )
  );
$$;

grant execute on function public.search_contests(text, text[], text[], text[], int, int)
  to anon, authenticated;
