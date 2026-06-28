import { functions } from 'app/provider/appwrite/api'
import { SYNC_PUBLIC_CONTESTS_FUNCTION_ID } from 'app/provider/appwrite/constants'

export interface SyncPublicContestsResult {
  success: boolean
  contests?: {
    synced: number
    created: number
    updated: number
    deleted: number
  }
  translations?: {
    synced: number
    created: number
    updated: number
    deleted: number
  }
  duration_ms: number
  error?: string
  details?: string
}

/**
 * Sync public contests to the denormalized collection (admin only)
 * This function:
 * 1. Fetches all public contests (visibility: 'any')
 * 2. Enriches with hosts, categories, upvote counts
 * 3. Syncs to publicContests collection
 * 4. Syncs translations to publicContestTranslations collection
 */
export async function syncPublicContests(): Promise<SyncPublicContestsResult> {
  try {
    console.log('🔄 Syncing public contests...')
    const execution = await functions.createExecution(
      SYNC_PUBLIC_CONTESTS_FUNCTION_ID,
      JSON.stringify({}),
    )

    const responseBody =
      (execution as any).responseBody ??
      (execution as any).response ??
      execution

    if (typeof responseBody === 'string') {
      const result = JSON.parse(responseBody) as SyncPublicContestsResult
      if (result.success) {
        console.log(
          `✅ Public contests synced: ${result.contests?.synced ?? 0} contests, ${result.translations?.synced ?? 0} translations`,
        )
      } else {
        console.error('❌ Sync failed:', result.error)
      }
      return result
    }

    return responseBody as SyncPublicContestsResult
  } catch (error) {
    console.error('Error syncing public contests:', error)
    throw error
  }
}
