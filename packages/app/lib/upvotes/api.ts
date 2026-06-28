import { ID, Query, Permission, Role } from 'app/lib/appwrite-universal'
import { tablesDB } from 'app/provider/appwrite/api'
import {
  DATABASE_ID,
  CONTEST_UPVOTES_COLLECTION_ID,
} from 'app/provider/appwrite/constants'

/**
 * Check if a user has upvoted a specific contest
 * @param contestId - The contest ID
 * @param userId - The user ID
 * @returns Promise<boolean> - True if user has upvoted, false otherwise
 */
export async function checkUserUpvote(
  contestId: string,
  userId: string
): Promise<boolean> {
  try {
    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: CONTEST_UPVOTES_COLLECTION_ID,
      queries: [
        Query.equal('contest_id', contestId),
        Query.equal('user_id', userId),
        Query.limit(1),
      ],
    })

    return response.rows.length > 0
  } catch (error) {
    console.error('Error checking user upvote:', error)
    return false
  }
}

/**
 * Create an upvote for a contest
 * @param contestId - The contest ID
 * @param userId - The user ID
 * @throws Error if upvote already exists (409) or other errors
 */
export async function createUpvote(
  contestId: string,
  userId: string
): Promise<void> {
  try {
    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: CONTEST_UPVOTES_COLLECTION_ID,
      rowId: ID.unique(),
      data: {
        contest_id: contestId,
        user_id: userId,
      },
      permissions: [Permission.delete(Role.user(userId))],
    })
  } catch (error: any) {
    // Handle duplicate upvote error
    if (error.code === 409) {
      throw new Error('You have already upvoted this contest')
    }
    console.error('Error creating upvote:', error)
    throw error
  }
}

/**
 * Remove a user's upvote from a contest
 * @param contestId - The contest ID
 * @param userId - The user ID
 */
export async function removeUpvote(
  contestId: string,
  userId: string
): Promise<void> {
  try {
    // First, find the upvote document
    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: CONTEST_UPVOTES_COLLECTION_ID,
      queries: [
        Query.equal('contest_id', contestId),
        Query.equal('user_id', userId),
        Query.limit(1),
      ],
    })

    if (response.rows.length === 0) {
      console.warn('No upvote found to remove')
      return
    }

    // Delete the upvote document
    const upvoteDoc = response.rows[0]
    if (upvoteDoc) {
      await tablesDB.deleteRow({
        databaseId: DATABASE_ID,
        tableId: CONTEST_UPVOTES_COLLECTION_ID,
        rowId: upvoteDoc.$id,
      })
    }
  } catch (error) {
    console.error('Error removing upvote:', error)
    throw error
  }
}

/**
 * Get the upvote count for a contest by counting documents in Contest Upvotes table
 * @param contestId - The contest ID
 * @returns Promise<number> - The upvote count
 */
export async function getUpvoteCount(contestId: string): Promise<number> {
  try {
    // Count upvotes directly from Contest Upvotes table
    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: CONTEST_UPVOTES_COLLECTION_ID,
      queries: [Query.equal('contest_id', contestId), Query.limit(1)], // limit 1 to just get total count
    })

    return response.total
  } catch (error) {
    console.error('Error getting upvote count:', error)
    return 0 // Return 0 on error instead of throwing
  }
}
