import { ID, Query, Permission, Role } from 'app/lib/appwrite-universal'
import { tablesDB } from 'app/provider/appwrite/api'
import {
  DATABASE_ID,
  CONTEST_SAVES_COLLECTION_ID,
  CONTEST_UPVOTES_COLLECTION_ID,
  CONTESTS_COLLECTION_ID,
} from 'app/provider/appwrite/constants'
import { checkUserUpvote } from 'app/lib/upvotes/api'

/**
 * Check if a user has saved a specific contest
 * @param contestId - The contest ID
 * @param userId - The user ID
 * @returns Promise<boolean> - True if user has saved, false otherwise
 */
export async function checkUserSave(
  contestId: string,
  userId: string
): Promise<boolean> {
  try {
    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: CONTEST_SAVES_COLLECTION_ID,
      queries: [
        Query.equal('contest_id', contestId),
        Query.equal('user_id', userId),
        Query.limit(1),
      ],
    })

    return response.rows.length > 0
  } catch (error) {
    console.error('Error checking user save:', error)
    return false
  }
}

/**
 * Create a save for a contest
 * @param contestId - The contest ID
 * @param userId - The user ID
 * @throws Error if save already exists (409) or other errors
 */
export async function createSave(
  contestId: string,
  userId: string
): Promise<void> {
  try {
    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: CONTEST_SAVES_COLLECTION_ID,
      rowId: ID.unique(),
      data: {
        contest_id: contestId,
        user_id: userId,
      },
      permissions: [Permission.read(Role.user(userId)), Permission.delete(Role.user(userId))],
    })
  } catch (error: any) {
    // Handle duplicate save error
    if (error.code === 409) {
      throw new Error('You have already saved this contest')
    }
    console.error('Error creating save:', error)
    throw error
  }
}

/**
 * Get the save document ID for a user's save on a contest
 * @param contestId - The contest ID
 * @param userId - The user ID
 * @returns Promise<string | null> - The document ID or null if not found
 */
export async function getSaveDocumentId(
  contestId: string,
  userId: string
): Promise<string | null> {
  try {
    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: CONTEST_SAVES_COLLECTION_ID,
      queries: [
        Query.equal('contest_id', contestId),
        Query.equal('user_id', userId),
        Query.limit(1),
      ],
    })

    if (response.rows.length === 0) {
      return null
    }

    const document = response.rows[0]
    return document?.$id ?? null
  } catch (error) {
    console.error('Error getting save document ID:', error)
    return null
  }
}

/**
 * Remove a user's save from a contest
 * @param contestId - The contest ID
 * @param userId - The user ID
 */
export async function removeSave(
  contestId: string,
  userId: string
): Promise<void> {
  try {
    // First, find the save document
    const documentId = await getSaveDocumentId(contestId, userId)

    if (!documentId) {
      console.warn('No save found to remove')
      return
    }

    // Delete the save document
    await tablesDB.deleteRow({
      databaseId: DATABASE_ID,
      tableId: CONTEST_SAVES_COLLECTION_ID,
      rowId: documentId,
    })
  } catch (error) {
    console.error('Error removing save:', error)
    throw error
  }
}

/**
 * Get user's saved contests with pagination support
 * @param userId - The user ID
 * @param options - Pagination options (limit and offset)
 * @returns Promise<any[]> - Array of contest documents with savedAt timestamp
 */
export async function getUserSavedContests(
  userId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<any[]> {
  const { limit = 20, offset = 0 } = options

  try {
    // First, get all saves for the user
    const savesResponse = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: CONTEST_SAVES_COLLECTION_ID,
      queries: [
        Query.equal('user_id', userId),
        Query.orderDesc('$createdAt'),
        Query.limit(limit),
        Query.offset(offset),
      ],
    })

    if (savesResponse.rows.length === 0) {
      return []
    }

    // Create a map of contest ID to save timestamp
    const saveTimestamps = new Map<string, string>()
    savesResponse.rows.forEach((doc: any) => {
      saveTimestamps.set(doc.contest_id, doc.$createdAt)
    })

    // Extract contest IDs
    const contestIds = savesResponse.rows.map((doc: any) => doc.contest_id)

    // Fetch all contest details in a single batch query
    try {
      const contestsResponse = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: CONTESTS_COLLECTION_ID,
        queries: [Query.equal('$id', contestIds), Query.limit(contestIds.length)],
      })

      // Add the savedAt timestamp to each contest and maintain the order
      const contestsMap = new Map(
        contestsResponse.rows.map((contest: any) => [
          contest.$id,
          {
            ...contest,
            savedAt: saveTimestamps.get(contest.$id),
          },
        ])
      )

      // Return contests in the same order as the saves (most recent first)
      return contestIds
        .map((id) => contestsMap.get(id))
        .filter((contest) => contest !== undefined)
    } catch (error) {
      console.error('Error fetching contests:', error)
      // Fallback to individual fetches if batch query fails
      const contests = await Promise.all(
        contestIds.map(async (contestId: string) => {
          try {
            const contest = await tablesDB.getRow({
              databaseId: DATABASE_ID,
              tableId: CONTESTS_COLLECTION_ID,
              rowId: contestId,
            })
            return {
              ...contest,
              savedAt: saveTimestamps.get(contestId),
            }
          } catch (error) {
            console.error(`Error fetching contest ${contestId}:`, error)
            return null
          }
        })
      )
      return contests.filter((contest) => contest !== null)
    }
  } catch (error) {
    console.error('Error getting user saved contests:', error)
    return []
  }
}

/**
 * Result of saveWithAutoUpvote operation
 */
export interface SaveWithAutoUpvoteResult {
  success: boolean
  autoUpvoted: boolean
  warning?: string
}

/**
 * Save a contest and automatically upvote it if not already upvoted
 *
 * This function implements the automatic upvote integration feature with transactions:
 * - When a user saves a contest, it automatically upvotes it (if not already upvoted)
 * - Uses transactions to ensure atomicity - either both succeed or neither
 * - Returns a result object indicating whether auto-upvote occurred
 *
 * @param contestId - The contest ID
 * @param userId - The user ID
 * @returns Promise<SaveWithAutoUpvoteResult> - Result with success status and warnings
 * @throws Error if either save or upvote operation fails
 */
export async function saveWithAutoUpvote(
  contestId: string,
  userId: string
): Promise<SaveWithAutoUpvoteResult> {
  // Create transaction for atomic save + upvote using TablesDB
  const transaction = await tablesDB.createTransaction()
  const transactionId = transaction.$id

  try {
    // 1. Stage the save document creation
    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: CONTEST_SAVES_COLLECTION_ID,
      rowId: ID.unique(),
      data: {
        contest_id: contestId,
        user_id: userId,
      },
      permissions: [Permission.read(Role.user(userId)), Permission.delete(Role.user(userId))],
      transactionId,
    })

    // 2. Check if user has already upvoted the contest
    const isUpvoted = await checkUserUpvote(contestId, userId)

    let autoUpvoted = false

    // 3. If not upvoted, stage upvote creation in the same transaction
    if (!isUpvoted) {
      await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: CONTEST_UPVOTES_COLLECTION_ID,
        rowId: ID.unique(),
        data: {
          contest_id: contestId,
          user_id: userId,
        },
        permissions: [Permission.delete(Role.user(userId))],
        transactionId,
      })
      autoUpvoted = true
    }

    // 4. Commit transaction - both operations succeed atomically
    await tablesDB.updateTransaction({ transactionId, commit: true })

    return {
      success: true,
      autoUpvoted,
    }
  } catch (error: any) {
    // Rollback transaction on any error
    try {
      await tablesDB.updateTransaction({ transactionId, rollback: true })
    } catch (rollbackError) {
      console.error('Failed to rollback transaction:', rollbackError)
    }

    // Handle duplicate save error
    if (error.code === 409) {
      throw new Error('You have already saved this contest')
    }
    
    console.error('Save with auto-upvote failed:', error)
    throw error
  }
}
