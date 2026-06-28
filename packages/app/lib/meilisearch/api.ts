import { functions } from 'app/provider/appwrite/api'

// Function IDs - these need to be set after deploying the functions
const MEILISEARCH_SEARCH_FUNCTION_ID = '68c0fb9d00000f1ab95c' // 'meilisearch-search' // Replace with actual function ID
const MEILISEARCH_ADMIN_FUNCTION_ID = '68c0f9db0023bb7cc14f' // 'meilisearch-admin' // Replace with actual function ID

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
 * Search contests using Meilisearch via Appwrite Function
 */
export async function searchContests(
  params: SearchParams = {}
): Promise<SearchResult> {
  try {
    const execution = await functions.createExecution(
      MEILISEARCH_SEARCH_FUNCTION_ID,
      JSON.stringify(params)
    )

    const responseBody =
      (execution as any).responseBody ??
      (execution as any).response ??
      execution

    if (typeof responseBody === 'string') {
      return JSON.parse(responseBody)
    }

    return responseBody
  } catch (error) {
    console.error('Error searching contests:', error)
    throw error
  }
}

/**
 * Setup Meilisearch index (admin only)
 */
export async function setupMeilisearchIndex(): Promise<any> {
  try {
    console.log('🔄 Setting up Meilisearch index via Appwrite Function...')
    const execution = await functions.createExecution(
      MEILISEARCH_ADMIN_FUNCTION_ID,
      JSON.stringify({ action: 'setup' })
    )

    const responseBody =
      (execution as any).responseBody ??
      (execution as any).response ??
      execution

    if (typeof responseBody === 'string') {
      const result = JSON.parse(responseBody)
      console.log('✅ Meilisearch index configured successfully')
      return result
    }

    console.log('✅ Meilisearch index configured successfully')
    return responseBody
  } catch (error) {
    console.error('❌ Error setting up Meilisearch index:', error)
    throw error
  }
}

/**
 * Sync all contests to Meilisearch (admin only)
 */
export async function syncContestsToMeilisearch(): Promise<any> {
  try {
    console.log('🔄 Starting sync from Appwrite to Meilisearch via Function...')
    const execution = await functions.createExecution(
      MEILISEARCH_ADMIN_FUNCTION_ID,
      JSON.stringify({ action: 'sync' })
    )

    const responseBody =
      (execution as any).responseBody ??
      (execution as any).response ??
      execution

    if (typeof responseBody === 'string') {
      const result = JSON.parse(responseBody)
      console.log('✅ Successfully synced contests to Meilisearch')
      return result
    }

    console.log('✅ Successfully synced contests to Meilisearch')
    return responseBody
  } catch (error) {
    console.error('❌ Error syncing contests to Meilisearch:', error)
    throw error
  }
}

/**
 * Add or update a contest in Meilisearch (admin only)
 */
export async function addContestToMeilisearch(contestData: any): Promise<any> {
  try {
    const execution = await functions.createExecution(
      MEILISEARCH_ADMIN_FUNCTION_ID,
      JSON.stringify({
        action: 'add',
        contestData,
      })
    )

    const responseBody =
      (execution as any).responseBody ??
      (execution as any).response ??
      execution

    if (typeof responseBody === 'string') {
      const result = JSON.parse(responseBody)
      console.log('✅ Contest added/updated in Meilisearch:', contestData.title)
      return result
    }

    console.log('✅ Contest added/updated in Meilisearch:', contestData.title)
    return responseBody
  } catch (error) {
    console.error('❌ Error adding contest to Meilisearch:', error)
    throw error
  }
}

/**
 * Delete a contest from Meilisearch (admin only)
 */
export async function deleteContestFromMeilisearch(
  contestId: string
): Promise<any> {
  try {
    const execution = await functions.createExecution(
      MEILISEARCH_ADMIN_FUNCTION_ID,
      JSON.stringify({
        action: 'delete',
        contestId,
      })
    )

    const responseBody =
      (execution as any).responseBody ??
      (execution as any).response ??
      execution

    if (typeof responseBody === 'string') {
      const result = JSON.parse(responseBody)
      console.log('✅ Contest deleted from Meilisearch:', contestId)
      return result
    }

    console.log('✅ Contest deleted from Meilisearch:', contestId)
    return responseBody
  } catch (error) {
    console.error('❌ Error deleting contest from Meilisearch:', error)
    throw error
  }
}
