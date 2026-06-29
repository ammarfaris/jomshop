import type { SearchParams, SearchResult } from 'app/lib/meilisearch/api'
import { getSupabase } from './client'

const PUBLIC_VISIBILITY = ['users', 'any']

export interface SupabasePublicHost {
  $id: string
  name: string
  img_id: string
}

export interface SupabasePublicCategory {
  $id: string
  name_en: string
  name_ms: string
  slug: string
  priority_order: number
  type: 'prize' | 'winner_selection' | 'how_to_enter' | 'business_category' | null
}

/**
 * Shape returned to the public-contests UI. Intentionally a structural subset of
 * `EnrichedPublicContest` (the consuming screens read a subset of fields); the
 * hook casts it across so screens stay untouched during the spike.
 */
export interface SupabasePublicContest {
  $id: string
  source_contest_id: string
  slug: string
  title: string
  title_ms: string | null
  summary: string
  summary_ms: string | null
  start_date: string
  end_date: string
  main_img_id: string | null
  main_img_token_secret: string | null
  main_img_blurhash: string | null
  total_prizes_value_rm: number
  upvote_count: number
  hosts: SupabasePublicHost[]
  categories: SupabasePublicCategory[]
}

interface ContestListRow {
  id: string
  slug: string
  title: string
  title_ms: string | null
  summary: string | null
  summary_ms: string | null
  start_date: string
  end_date: string
  main_img_id: string | null
  main_img_blurhash: string | null
  total_prizes_value_rm: number | null
  contest_hosts_map:
    | { contest_hosts: { id: string; name: string } | null }[]
    | null
  contest_categories_map:
    | {
        contest_categories: {
          id: string
          name_en: string | null
          name_ms: string | null
          slug: string | null
          priority_order: number | null
          type: string | null
        } | null
      }[]
    | null
}

function mapListRow(row: ContestListRow): SupabasePublicContest {
  const hosts = (row.contest_hosts_map ?? [])
    .map((m) => m.contest_hosts)
    .filter((h): h is { id: string; name: string } => Boolean(h))
    // Spike host rows have no logo column yet; '' → HostImage renders nothing.
    .map((h) => ({ $id: h.id, name: h.name, img_id: '' }))

  const categories = (row.contest_categories_map ?? [])
    .map((m) => m.contest_categories)
    .filter((k): k is NonNullable<typeof k> => Boolean(k))
    .map((k) => ({
      $id: k.id,
      name_en: k.name_en ?? '',
      name_ms: k.name_ms ?? '',
      slug: k.slug ?? '',
      priority_order: k.priority_order ?? 0,
      type: (k.type as SupabasePublicCategory['type']) ?? null,
    }))

  return {
    $id: row.id,
    source_contest_id: row.id,
    slug: row.slug,
    title: row.title,
    title_ms: row.title_ms,
    summary: row.summary ?? '',
    summary_ms: row.summary_ms,
    start_date: row.start_date,
    end_date: row.end_date,
    main_img_id: row.main_img_id,
    main_img_token_secret: null,
    main_img_blurhash: row.main_img_blurhash,
    total_prizes_value_rm: row.total_prizes_value_rm ?? 0,
    upvote_count: 0,
    hosts,
    categories,
  }
}

/**
 * Public contests list via anon RLS (replaces the publicContests collection +
 * its sync function). Ordered by soonest-ending first to match current UX.
 */
// Shared PostgREST select (list + detail). Embeds host/category names via junctions.
const CONTEST_SELECT =
  'id, slug, title, title_ms, summary, summary_ms, start_date, end_date, main_img_id, main_img_blurhash, total_prizes_value_rm, contest_hosts_map(contest_hosts(id,name)), contest_categories_map(contest_categories(id,name_en,name_ms,slug,priority_order,type))'

export async function fetchPublicContestsSupabase(
  limit = 20,
): Promise<SupabasePublicContest[]> {
  const { data, error } = await getSupabase()
    .from('contests')
    .select(CONTEST_SELECT)
    .in('visibility', PUBLIC_VISIBILITY)
    .order('end_date', { ascending: false })
    .limit(limit)

  if (error) throw error
  return ((data ?? []) as unknown as ContestListRow[]).map(mapListRow)
}

/**
 * Single public contest by slug (detail view). Returns null when not found or
 * not publicly visible (RLS). Rich translations aren't modeled in the spike yet.
 */
export async function fetchPublicContestBySlugSupabase(
  slug: string,
): Promise<SupabasePublicContest | null> {
  const { data, error } = await getSupabase()
    .from('contests')
    .select(CONTEST_SELECT)
    .eq('slug', slug)
    .in('visibility', PUBLIC_VISIBILITY)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapListRow(data as unknown as ContestListRow)
}

/**
 * Search via the `search_contests` Postgres RPC (FTS + pg_trgm). Returns the
 * Meilisearch-compatible shape so callers don't change.
 */
export async function searchContestsSupabase(
  params: SearchParams = {},
): Promise<SearchResult> {
  const { query = '', filters = {}, limit = 20, offset = 0 } = params
  const f = filters as Record<string, string[] | undefined>

  const { data, error } = await getSupabase().rpc('search_contests', {
    q: query,
    filter_host_names: f.host_names ?? null,
    filter_category_names_en: f.category_names_en ?? null,
    filter_category_names_ms: f.category_names_ms ?? null,
    lim: limit,
    off: offset,
  })

  if (error) throw error
  return data as SearchResult
}
