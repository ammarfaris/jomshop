import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'app/contexts/AuthContext'
import type { Document } from 'app/lib/types'
import {
  fetchPublicContestsSupabase,
  fetchContestDetailSupabase,
} from 'app/lib/supabase/contests'

/**
 * Public contest document from publicContests collection
 * This is the denormalized version for anonymous users
 */
export type PublicContest = Document & {
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
export type PublicContestTranslation = Document & {
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
 * Hook to fetch public contests directly from the publicContests collection.
 * Uses read("any") permission - no authentication required.
 * Much faster than function-based approach (no cold start).
 */
export function usePublicContests(options: UsePublicContestsOptions = {}) {
  const { limit = 20, enabled = true } = options

  return useQuery({
    queryKey: ['public-contests', 'supabase', limit],
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async () => {
      // Supabase path (Phase 0 spike): read contests via anon RLS — no sync needed.
      const rows = await fetchPublicContestsSupabase(limit)
      return rows as unknown as EnrichedPublicContest[]
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
  // Premium translations + affiliate links are gated by auth inside the Supabase
  // fetch, so the cache must be keyed by auth state. Otherwise an anonymous view
  // followed by sign-in keeps serving the stale (non-premium) payload.
  const { user } = useAuth()

  return useQuery({
    queryKey: ['public-contest', 'supabase', slug, user?.$id ?? 'anon'],
    enabled: enabled && !!slug,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async () => {
      // Supabase path: single contest via anon RLS, now with translations +
      // gallery files (premium fields gated by auth inside the fetch).
      const detail = await fetchContestDetailSupabase(slug)
      if (!detail) throw new Error('Contest not found')
      return {
        contest: detail.contest as unknown as EnrichedPublicContest,
        translations:
          detail.translations as unknown as PublicContestTranslation[],
      }
    },
  })
}
