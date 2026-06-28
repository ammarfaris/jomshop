const { Client, TablesDB, Query } = require('node-appwrite')

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  INTERNAL_API_KEY,
  DATABASE_ID,
  RATE_LIMITS_COLLECTION_ID,
} = process.env

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(INTERNAL_API_KEY)

const tablesDB = new TablesDB(client)

const BATCH_SIZE = 100

async function deleteExpiredRateLimits(log) {
  // Keep only recent activity used for live limits
  const cutoffIso = new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1 hour
  let deleted = 0
  let hasMore = true
  log('Starting manual cleanup of expired rate limit entries...')

  while (hasMore) {
    const list = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: RATE_LIMITS_COLLECTION_ID,
      queries: [Query.lessThan('$createdAt', cutoffIso), Query.limit(BATCH_SIZE)],
    })

    if (list.rows.length === 0) {
      hasMore = false
      break
    }

    for (const doc of list.rows) {
      await tablesDB.deleteRow({
        databaseId: DATABASE_ID,
        tableId: RATE_LIMITS_COLLECTION_ID,
        rowId: doc.$id,
      })
      deleted++
    }
    log(`Deleted ${list.rows.length} expired entries. Total: ${deleted}`)
  }

  return deleted
}

module.exports = async ({ req, res, log, error }) => {
  try {
    const count = await deleteExpiredRateLimits(log)
    return res.json({ success: true, deleted: count })
  } catch (err) {
    error(`Manual cleanup failed: ${err.message}`)
    return res.json({ success: false, error: 'Manual cleanup failed' }, 500)
  }
}
