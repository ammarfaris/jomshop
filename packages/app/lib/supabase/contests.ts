import type { SearchParams, SearchResult } from 'app/lib/meilisearch/api'
import { getSupabase } from './client'

const PUBLIC_VISIBILITY = ['users', 'any']

/**
 * Resolve a storage object path to a public URL. Pass-through for values that
 * are already absolute URLs (the seed + legacy rows store full URLs). Returns ''
 * for empty so image components render nothing.
 */
function publicUrl(
  bucket: string,
  pathOrUrl: string | null | undefined,
): string {
  if (!pathOrUrl) return ''
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  return getSupabase().storage.from(bucket).getPublicUrl(pathOrUrl).data.publicUrl
}

export interface SupabasePublicHost {
  $id: string
  name: string
  slug: string
  img_id: string
  img_token_secret: string | null
  img_blurhash: string | null
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
 * hook casts it across so screens stay untouched.
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
  visibility: string
  hosts: SupabasePublicHost[]
  categories: SupabasePublicCategory[]
}

interface HostRow {
  id: string
  name: string
  slug: string | null
  img_id: string | null
  img_blurhash: string | null
}

interface CategoryRow {
  id: string
  name_en: string | null
  name_ms: string | null
  slug: string | null
  priority_order: number | null
  type: string | null
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
  upvote_count: number | null
  visibility: string
  contest_hosts_map: { contest_hosts: HostRow | null }[] | null
  contest_categories_map: { contest_categories: CategoryRow | null }[] | null
}

function mapHost(h: HostRow): SupabasePublicHost {
  return {
    $id: h.id,
    name: h.name,
    slug: h.slug ?? '',
    // Public bucket -> resolve to a public URL; HostImage handles absolute URLs.
    img_id: publicUrl('contest-hosts', h.img_id),
    img_token_secret: null,
    img_blurhash: h.img_blurhash,
  }
}

function mapCategory(k: CategoryRow): SupabasePublicCategory {
  return {
    $id: k.id,
    name_en: k.name_en ?? '',
    name_ms: k.name_ms ?? '',
    slug: k.slug ?? '',
    priority_order: k.priority_order ?? 0,
    type: (k.type as SupabasePublicCategory['type']) ?? null,
  }
}

function mapListRow(row: ContestListRow): SupabasePublicContest {
  const hosts = (row.contest_hosts_map ?? [])
    .map((m) => m.contest_hosts)
    .filter((h): h is HostRow => Boolean(h))
    .map(mapHost)

  const categories = (row.contest_categories_map ?? [])
    .map((m) => m.contest_categories)
    .filter((k): k is CategoryRow => Boolean(k))
    .map(mapCategory)

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
    main_img_id: publicUrl('contests', row.main_img_id) || null,
    main_img_token_secret: null,
    main_img_blurhash: row.main_img_blurhash,
    total_prizes_value_rm: row.total_prizes_value_rm ?? 0,
    upvote_count: row.upvote_count ?? 0,
    visibility: row.visibility,
    hosts,
    categories,
  }
}

// Shared PostgREST select (list). Embeds host/category rows via junctions.
const CONTEST_LIST_SELECT =
  'id, slug, title, title_ms, summary, summary_ms, start_date, end_date, main_img_id, main_img_blurhash, total_prizes_value_rm, upvote_count, visibility, contest_hosts_map(contest_hosts(id,name,slug,img_id,img_blurhash)), contest_categories_map(contest_categories(id,name_en,name_ms,slug,priority_order,type))'

/**
 * Public contests list via anon RLS (replaces the publicContests collection +
 * its sync function). Ordered latest-ending first to match current UX.
 *
 * Supports offset pagination for the infinite-scroll home feed. `includeHidden`
 * drops the visibility filter so admins can see admin-only contests too — RLS
 * still blocks hidden rows for everyone else, so this is safe to pass through.
 */
export async function fetchPublicContestsSupabase(
  limit = 20,
  offset = 0,
  includeHidden = false,
): Promise<SupabasePublicContest[]> {
  let query = getSupabase().from('contests').select(CONTEST_LIST_SELECT)
  if (!includeHidden) query = query.in('visibility', PUBLIC_VISIBILITY)

  const { data, error } = await query
    .order('end_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return ((data ?? []) as unknown as ContestListRow[]).map(mapListRow)
}

/**
 * Single public contest by slug (list shape, no translations/files). Kept for
 * back-compat; the detail screen uses fetchContestDetailSupabase below.
 */
export async function fetchPublicContestBySlugSupabase(
  slug: string,
): Promise<SupabasePublicContest | null> {
  const { data, error } = await getSupabase()
    .from('contests')
    .select(CONTEST_LIST_SELECT)
    .eq('slug', slug)
    .in('visibility', PUBLIC_VISIBILITY)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapListRow(data as unknown as ContestListRow)
}

/**
 * Fetch a set of contests by id (list shape). Used by the saved-contests list.
 * Order is not guaranteed — callers re-order to match their own sequence.
 */
export async function fetchContestsByIdsSupabase(
  ids: string[],
): Promise<SupabasePublicContest[]> {
  if (ids.length === 0) return []
  const { data, error } = await getSupabase()
    .from('contests')
    .select(CONTEST_LIST_SELECT)
    .in('id', ids)

  if (error) throw error
  return ((data ?? []) as unknown as ContestListRow[]).map(mapListRow)
}

// ---------------------------------------------------------------------------
// Contest detail (translations + gallery files). Premium translation fields and
// affiliate links are only fetched for authenticated users — anonymous callers
// get the public subset (mirrors the old publicContestTranslations gating).
// ---------------------------------------------------------------------------

export interface SupabaseContestFile {
  $id: string
  contest_id: string
  file_id: string
  token_secret: string | null
  img_blurhash: string | null
  file_order: number
}

export interface SupabaseContestTranslation {
  $id: string
  // ContestDetailScreen filters translations by source_contest_id (legacy
  // Appwrite shape), so we stamp the contest id here for parity.
  source_contest_id: string
  locale: 'en' | 'ms'
  prizes: string | null
  eligible_products_and_purchases: string | null
  eligible_participants: string | null
  eligible_participants_exclusion: string | null
  eligible_stores: string | null
  entry_method_and_submission: string | null
  // Premium (authenticated only)
  winners_selection_method?: string | null
  winners_comm_and_timeline?: string | null
  winners_list_and_announcement?: string | null
  link_tnc?: string | null
  link_faq?: string | null
}

const TRANSLATION_BASE_COLS = [
  'locale',
  'prizes',
  'eligible_products',
  'eligible_participants',
  'eligible_participants_exclusion',
  'eligible_stores',
  'entry_method',
]
const TRANSLATION_PREMIUM_COLS = [
  'winners_selection_method',
  'winners_comm_and_timeline',
  'winners_list_and_announcement',
  'link_tnc',
  'link_faq',
]

const CONTEST_BASE_COLS = [
  'id',
  'slug',
  'title',
  'title_ms',
  'summary',
  'summary_ms',
  'start_date',
  'end_date',
  'main_img_id',
  'main_img_blurhash',
  'total_prizes_value_rm',
  'upvote_count',
  'visibility',
  'link_media_instagram',
  'link_media_facebook',
  'link_media_tiktok',
  'link_media_x',
  'link_media_youtube',
  'link_media_website',
  'link_media_linkedin',
]
const CONTEST_PREMIUM_COLS = [
  'link_aff_shopee',
  'link_aff_lazada',
  'link_aff_tiktok_shop',
]

interface ContestDetailResult {
  contest: Record<string, any>
  translations: SupabaseContestTranslation[]
  files: SupabaseContestFile[]
}

function mapTranslationRow(
  r: any,
  sourceContestId: string,
): SupabaseContestTranslation {
  return {
    $id: `${r.locale}`,
    source_contest_id: sourceContestId,
    locale: r.locale,
    prizes: r.prizes ?? null,
    // Column stems differ from the screen's field names (legacy Appwrite names).
    eligible_products_and_purchases: r.eligible_products ?? null,
    eligible_participants: r.eligible_participants ?? null,
    eligible_participants_exclusion: r.eligible_participants_exclusion ?? null,
    eligible_stores: r.eligible_stores ?? null,
    entry_method_and_submission: r.entry_method ?? null,
    winners_selection_method: r.winners_selection_method ?? null,
    winners_comm_and_timeline: r.winners_comm_and_timeline ?? null,
    winners_list_and_announcement: r.winners_list_and_announcement ?? null,
    link_tnc: r.link_tnc ?? null,
    link_faq: r.link_faq ?? null,
  }
}

/**
 * Full contest detail by slug for the detail screen. Returns the enriched
 * contest (with files attached), localized translations, and gallery files.
 */
export async function fetchContestDetailSupabase(
  slug: string,
): Promise<ContestDetailResult | null> {
  const supabase = getSupabase()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const authed = !!user

  const contestCols = authed
    ? [...CONTEST_BASE_COLS, ...CONTEST_PREMIUM_COLS]
    : CONTEST_BASE_COLS
  const translationCols = authed
    ? [...TRANSLATION_BASE_COLS, ...TRANSLATION_PREMIUM_COLS]
    : TRANSLATION_BASE_COLS

  const select = `${contestCols.join(', ')}, contest_hosts_map(contest_hosts(id,name,slug,img_id,img_blurhash)), contest_categories_map(contest_categories(id,name_en,name_ms,slug,priority_order,type)), contest_translations(${translationCols.join(',')}), contest_files(id,storage_path,blurhash,file_order)`

  const { data, error } = await supabase
    .from('contests')
    .select(select)
    .eq('slug', slug)
    .in('visibility', PUBLIC_VISIBILITY)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const row = data as any

  const hosts = (row.contest_hosts_map ?? [])
    .map((m: any) => m.contest_hosts)
    .filter(Boolean)
    .map(mapHost)

  const categories = (row.contest_categories_map ?? [])
    .map((m: any) => m.contest_categories)
    .filter(Boolean)
    .map(mapCategory)

  const files: SupabaseContestFile[] = (row.contest_files ?? [])
    .slice()
    .sort((a: any, b: any) => (a.file_order ?? 0) - (b.file_order ?? 0))
    .map((f: any) => ({
      $id: f.id,
      contest_id: row.id,
      file_id: publicUrl('contests', f.storage_path),
      token_secret: null,
      img_blurhash: f.blurhash ?? null,
      file_order: f.file_order ?? 0,
    }))

  const translations = (row.contest_translations ?? []).map((tr: any) =>
    mapTranslationRow(tr, row.id),
  )

  const contest: Record<string, any> = {
    $id: row.id,
    source_contest_id: row.id,
    slug: row.slug,
    title: row.title,
    title_ms: row.title_ms,
    summary: row.summary ?? '',
    summary_ms: row.summary_ms,
    start_date: row.start_date,
    end_date: row.end_date,
    main_img_id: publicUrl('contests', row.main_img_id) || null,
    main_img_token_secret: null,
    main_img_blurhash: row.main_img_blurhash,
    total_prizes_value_rm: row.total_prizes_value_rm ?? 0,
    upvote_count: row.upvote_count ?? 0,
    visibility: row.visibility,
    link_media_instagram: row.link_media_instagram ?? undefined,
    link_media_facebook: row.link_media_facebook ?? undefined,
    link_media_tiktok: row.link_media_tiktok ?? undefined,
    link_media_x: row.link_media_x ?? undefined,
    link_media_youtube: row.link_media_youtube ?? undefined,
    link_media_website: row.link_media_website ?? undefined,
    link_media_linkedin: row.link_media_linkedin ?? undefined,
    link_aff_shopee: row.link_aff_shopee ?? undefined,
    link_aff_lazada: row.link_aff_lazada ?? undefined,
    link_aff_tiktok_shop: row.link_aff_tiktok_shop ?? undefined,
    hosts,
    categories,
    files,
  }

  return { contest, translations, files }
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
