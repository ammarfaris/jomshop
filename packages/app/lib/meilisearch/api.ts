import { searchContestsSupabase } from 'app/lib/supabase/contests'

export interface SearchParams {
  query?: string
  filters?: Record<string, any>
  sort?: string[]
  limit?: number
  offset?: number
  attributesToRetrieve?: string[]
  attributesToHighlight?: string[]
  facets?: string[]
}

export interface SearchResult {
  hits: any[]
  query: string
  processingTimeMs: number
  limit: number
  offset: number
  estimatedTotalHits: number
  facetDistribution?: Record<string, any>
}

/**
 * Search contests via the Supabase `search_contests` RPC. Keeps the historical
 * Meilisearch result contract (hits / estimatedTotalHits / facetDistribution)
 * so callers didn't have to change during the migration.
 */
export async function searchContests(
  params: SearchParams = {},
): Promise<SearchResult> {
  return searchContestsSupabase(params)
}
