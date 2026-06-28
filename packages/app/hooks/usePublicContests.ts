import { useQuery } from '@tanstack/react-query'
import {
  DATABASE_ID,
  PUBLIC_CONTESTS_COLLECTION_ID,
  PUBLIC_CONTEST_TRANSLATIONS_COLLECTION_ID,
} from 'app/provider/appwrite/constants'
import { tablesDB } from 'app/provider/appwrite/api'
import { Query, Models } from 'app/lib/appwrite-universal'

/**
 * Public contest document from publicContests collection
 * This is the denormalized version for anonymous users
 */
export type PublicContest = Models.Document & {
  source_contest_id: string
  title: string
  title_ms?: string | null
  summary: string
  summary_ms?: string | null
  slug: string
  start_date: string
  end_date: string
  main_img_id?: string | null
  main_img_token_secret?: string | null
  main_img_blurhash?: string | null
  total_prizes_value_rm: number
  upvote_count: number
  hosts_json: string // JSON string of embedded hosts
  categories_json: string // JSON string of embedded categories
  link_media_instagram?: string | null
  link_media_facebook?: string | null
  link_media_tiktok?: string | null
  link_media_x?: string | null
  link_media_youtube?: string | null
  link_media_website?: string | null
  link_media_linkedin?: string | null
  synced_at: string
}

/**
 * Parsed host from hosts_json
 */
export type PublicHost = {
  $id: string
  name: string
  slug: string
  img_id: string
  img_token_secret?: string | null
  img_blurhash?: string | null
}

/**
 * Parsed category from categories_json
 */
export type PublicCategory = {
  $id: string
  name_en: string
  name_ms: string
  slug: string
  priority_order: number
  type: 'prize' | 'winner_selection' | 'how_to_enter' | 'business_category'
}

/**
 * Public translation document from publicContestTranslations collection
 *
 * Note: This intentionally excludes sensitive/premium fields like:
 * - link_tnc, link_faq
 * - winners_selection_method, winners_comm_and_timeline, winners_list_and_announcement
 *
 * These are gated behind authentication - anonymous users see "Sign in to view" prompts.
 */
export type PublicContestTranslation = Models.Document & {
  source_contest_id: string
  locale: 'en' | 'ms'
  prizes: string
  eligible_products_and_purchases?: string | null
  eligible_participants?: string | null
  eligible_participants_exclusion?: string | null
  eligible_stores?: string | null
  entry_method_and_submission?: string | null
  synced_at: string
}

/**
 * Enriched public contest with parsed hosts and categories
 */
export type EnrichedPublicContest = Omit<
  PublicContest,
  'hosts_json' | 'categories_json'
> & {
  hosts: PublicHost[]
  categories: PublicCategory[]
}

interface UsePublicContestsOptions {
  limit?: number
  enabled?: boolean
}

interface UsePublicContestBySlugOptions {
  enabled?: boolean
}

/**
 * Parse hosts_json and categories_json from a public contest
 */
function enrichPublicContest(contest: PublicContest): EnrichedPublicContest {
  let hosts: PublicHost[] = []
  let categories: PublicCategory[] = []

  try {
    hosts = JSON.parse(contest.hosts_json || '[]')
  } catch {
    hosts = []
  }

  try {
    categories = JSON.parse(contest.categories_json || '[]')
  } catch {
    categories = []
  }

  const { hosts_json, categories_json, ...rest } = contest
  return { ...rest, hosts, categories }
}

/**
 * Hook to fetch public contests directly from the publicContests collection.
 * Uses read("any") permission - no authentication required.
 * Much faster than function-based approach (no cold start).
 */
export function usePublicContests(options: UsePublicContestsOptions = {}) {
  const { limit = 20, enabled = true } = options

  return useQuery({
    queryKey: ['public-contests', limit],
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async () => {
      const response = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: PUBLIC_CONTESTS_COLLECTION_ID,
        queries: [Query.orderDesc('end_date'), Query.limit(limit)],
      })

      const contests = response.rows as unknown as PublicContest[]
      return contests.map(enrichPublicContest)
    },
  })
}

/**
 * Hook to fetch a single public contest by slug with its translations.
 * Uses read("any") permission - no authentication required.
 */
export function usePublicContestBySlug(
  slug: string,
  optionsOrEnabled: UsePublicContestBySlugOptions | boolean = {},
) {
  // Support both boolean (legacy) and options object
  const options =
    typeof optionsOrEnabled === 'boolean'
      ? { enabled: optionsOrEnabled }
      : optionsOrEnabled
  const { enabled = true } = options

  return useQuery({
    queryKey: ['public-contest', slug],
    enabled: enabled && !!slug,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async () => {
      // Fetch contest by slug
      const contestResponse = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: PUBLIC_CONTESTS_COLLECTION_ID,
        queries: [Query.equal('slug', slug), Query.limit(1)],
      })

      if (contestResponse.rows.length === 0) {
        throw new Error('Contest not found')
      }

      const contest = contestResponse.rows[0] as unknown as PublicContest
      const enrichedContest = enrichPublicContest(contest)

      // Fetch translations for this contest
      const translationsResponse = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: PUBLIC_CONTEST_TRANSLATIONS_COLLECTION_ID,
        queries: [Query.equal('source_contest_id', contest.source_contest_id)],
      })

      const translations =
        translationsResponse.rows as unknown as PublicContestTranslation[]

      return {
        contest: enrichedContest,
        translations,
      }
    },
  })
}

/**
 * Hook to fetch translations for a specific contest.
 * Useful when you already have the contest and need translations separately.
 */
export function usePublicContestTranslations(
  sourceContestId: string,
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options

  return useQuery({
    queryKey: ['public-contest-translations', sourceContestId],
    enabled: enabled && !!sourceContestId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
      const response = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: PUBLIC_CONTEST_TRANSLATIONS_COLLECTION_ID,
        queries: [Query.equal('source_contest_id', sourceContestId)],
      })

      return response.rows as unknown as PublicContestTranslation[]
    },
  })
}
