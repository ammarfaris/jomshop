/**
 * Cleanup Rate Limits - Scheduled Function
 *
 * This function runs on a schedule (e.g., daily) to clean up old rate limit records
 * Keeps the database lean by removing records older than their retention period
 *
 * Note: This only cleans up rateLimits collection.
 * Suspicious activity should be kept longer for security audits and compliance.
 */

const { Client, TablesDB, Query } = require('node-appwrite')

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  INTERNAL_API_KEY,
  DATABASE_ID,
  RATE_LIMITS_COLLECTION_ID,
} = process.env

// Retention period (in days)
const RETENTION_DAYS = 90 // Keep rate limit logs for 90 days

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(INTERNAL_API_KEY)

const tablesDB = new TablesDB(client)

/**
 * Delete documents older than retention period
 */
async function cleanupCollection(collectionId, retentionDays, collectionName) {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)
    const cutoffISO = cutoffDate.toISOString()

    let totalDeleted = 0
    let hasMore = true

    while (hasMore) {
      // Query old rows (batch of 100)
      const result = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: collectionId,
        queries: [
          Query.lessThan('$createdAt', cutoffISO),
          Query.limit(100),
        ],
      })

      if (result.rows.length === 0) {
        hasMore = false
        break
      }

      // Delete rows in batch
      for (const doc of result.rows) {
        try {
          await tablesDB.deleteRow({
            databaseId: DATABASE_ID,
            tableId: collectionId,
            rowId: doc.$id,
          })
          totalDeleted++
        } catch (error) {
          // Continue on error (row might have been deleted already)
        }
      }

      // Check if there are more rows
      hasMore = result.rows.length === 100
    }

    return { success: true, deleted: totalDeleted }
  } catch (error) {
    return { success: false, error: error.message, deleted: 0 }
  }
}

module.exports = async ({ req, res, log, error }) => {
  try {
    log('Starting cleanup of rate limits...')

    // Cleanup Rate Limits only
    log(`Cleaning up rate limits older than ${RETENTION_DAYS} days...`)
    const rateLimitsResult = await cleanupCollection(
      RATE_LIMITS_COLLECTION_ID,
      RETENTION_DAYS,
      'Rate Limits'
    )
    log(`Rate Limits cleanup: ${rateLimitsResult.deleted} documents deleted`)

    // Return summary
    return res.json({
      success: true,
      message: 'Cleanup completed successfully',
      summary: {
        rateLimits: {
          deleted: rateLimitsResult.deleted,
          retentionDays: RETENTION_DAYS,
        },
      },
    })
  } catch (err) {
    error(`Cleanup error: ${err.message}`)
    return res.json(
      {
        success: false,
        error: 'Cleanup failed',
      },
      500
    )
  }
}
