/**
 * Get User Points Function
 *
 * PURPOSE:
 * - Fetches user's current points balance
 * - Returns recent transaction history
 * - Provides lifetime stats
 *
 * SECURITY:
 * - Users can only fetch their own points (verified via JWT)
 * - Server functions can fetch any user's points (via internal API key)
 * - Read-only operation
 *
 * USAGE:
 * Client (authenticated user):
 * GET/POST /functions/get-user-points
 * No body needed - uses authenticated user's ID
 *
 * Server-to-server:
 * POST /functions/get-user-points
 * { "userId": "user123" }
 *
 * Query options:
 * {
 *   "includeTransactions": true,
 *   "transactionLimit": 10,
 *   "transactionOffset": 0
 * }
 *
 * RESPONSE:
 * {
 *   "success": true,
 *   "points": {
 *     "balance": 300,
 *     "lifetimeEarned": 400,
 *     "lifetimeSpent": 100,
 *     "canRedeemPlus": true,
 *     "canRedeemPro": false,
 *     "pointsToPlus": 0,
 *     "pointsToPro": 2700
 *   },
 *   "transactions": [...],
 *   "transactionCount": 5
 * }
 */

import { Client, TablesDB, Query } from 'node-appwrite'

// Redemption costs
const PLUS_COST = 1500
const PRO_COST = 3000

/**
 * Main function handler
 */
export default async ({ req, res, log, error }) => {
  // Environment variables
  const {
    APPWRITE_ENDPOINT,
    APPWRITE_PROJECT_ID,
    INTERNAL_API_KEY,
    DATABASE_ID,
    USER_POINTS_COLLECTION_ID,
    POINTS_TRANSACTIONS_COLLECTION_ID,
  } = process.env

  // Validate environment
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !INTERNAL_API_KEY) {
    error('Missing required environment variables')
    return res.json(
      {
        success: false,
        error: 'Server configuration error',
      },
      500
    )
  }

  if (
    !DATABASE_ID ||
    !USER_POINTS_COLLECTION_ID ||
    !POINTS_TRANSACTIONS_COLLECTION_ID
  ) {
    error('Missing database configuration')
    return res.json(
      {
        success: false,
        error: 'Database configuration error',
      },
      500
    )
  }

  // Determine user ID and access level
  let userId = null
  let isServerRequest = false

  // Check for internal API key (server-to-server)
  const authHeader =
    req.headers['x-internal-api-key'] || req.headers['authorization']
  if (INTERNAL_API_KEY && authHeader === `Bearer ${INTERNAL_API_KEY}`) {
    isServerRequest = true
  }

  // Check if called from another Appwrite function
  if (req.headers['x-appwrite-function-id']) {
    isServerRequest = true
  }

  // Get user ID from JWT headers
  if (req.headers['x-appwrite-user-id']) {
    userId = req.headers['x-appwrite-user-id']
  }

  // Parse request body for options and server-provided userId
  let options = {
    includeTransactions: true,
    transactionLimit: 10,
    transactionOffset: 0,
  }

  try {
    if (req.body) {
      const body =
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body

      // Server requests can specify any userId
      if (isServerRequest && body.userId) {
        userId = body.userId
      }

      // Merge options
      if (typeof body.includeTransactions === 'boolean') {
        options.includeTransactions = body.includeTransactions
      }
      if (typeof body.transactionLimit === 'number') {
        options.transactionLimit = Math.min(
          Math.max(body.transactionLimit, 1),
          100
        )
      }
      if (typeof body.transactionOffset === 'number') {
        options.transactionOffset = Math.max(body.transactionOffset, 0)
      }
    }
  } catch (e) {
    // Body parsing failed, continue with defaults
    log('No body or body parse failed, using defaults')
  }

  if (!userId) {
    return res.json(
      {
        success: false,
        error: 'User ID required. Must be authenticated.',
      },
      401
    )
  }

  // Initialize Appwrite client with API key
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(INTERNAL_API_KEY)

  const tablesDB = new TablesDB(client)

  try {
    // Get user's points record
    const pointsRecords = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: USER_POINTS_COLLECTION_ID,
      queries: [Query.equal('user_id', userId), Query.limit(1)],
    })

    let points = {
      balance: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
      canRedeemPlus: false,
      canRedeemPro: false,
      pointsToPlus: PLUS_COST,
      pointsToPro: PRO_COST,
      completedReferrals: 0,
    }

    let needsInitialization = false

    if (pointsRecords.total > 0) {
      const record = pointsRecords.rows[0]
      points = {
        balance: record.balance,
        lifetimeEarned: record.lifetime_earned,
        lifetimeSpent: record.lifetime_spent,
        canRedeemPlus: record.balance >= PLUS_COST,
        canRedeemPro: record.balance >= PRO_COST,
        pointsToPlus: Math.max(0, PLUS_COST - record.balance),
        pointsToPro: Math.max(0, PRO_COST - record.balance),
        completedReferrals: record.completed_referrals_count || 0,
      }
    } else {
      // User not initialized yet
      needsInitialization = true
    }

    // Get transactions if requested
    let transactions = []
    let transactionCount = 0

    if (options.includeTransactions) {
      // Get total count
      const countResult = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: POINTS_TRANSACTIONS_COLLECTION_ID,
        queries: [Query.equal('user_id', userId), Query.limit(1)],
      })
      transactionCount = countResult.total

      // Get paginated transactions
      if (transactionCount > 0) {
        const transactionDocs = await tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: POINTS_TRANSACTIONS_COLLECTION_ID,
          queries: [
            Query.equal('user_id', userId),
            Query.orderDesc('$createdAt'),
            Query.limit(options.transactionLimit),
            Query.offset(options.transactionOffset),
          ],
        })

        transactions = transactionDocs.rows.map((doc) => ({
          id: doc.$id,
          amount: doc.amount,
          type: doc.type,
          source: doc.source,
          description: doc.description,
          createdAt: doc.$createdAt, // Use Appwrite's built-in timestamp
        }))
      }
    }

    log(`Fetched points for user ${userId}: balance=${points.balance}`)

    return res.json({
      success: true,
      points,
      needsInitialization,
      transactions,
      transactionCount,
      pagination: {
        limit: options.transactionLimit,
        offset: options.transactionOffset,
        hasMore:
          options.transactionOffset + transactions.length < transactionCount,
      },
    })
  } catch (err) {
    error(`Failed to get points for user ${userId}: ${err.message}`)
    error(err.stack)

    return res.json(
      {
        success: false,
        error: 'Failed to fetch points',
        details:
          process.env.NODE_ENV === 'development' ? err.message : undefined,
      },
      500
    )
  }
}

/**
 * Helper function for server-to-server calls
 * Can be imported by other functions
 */
export async function getUserPoints(client, userId) {
  const { DATABASE_ID, USER_POINTS_COLLECTION_ID } = process.env

  const tablesDB = new TablesDB(client)

  const pointsRecords = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: USER_POINTS_COLLECTION_ID,
    queries: [Query.equal('user_id', userId), Query.limit(1)],
  })

  if (pointsRecords.total === 0) {
    return {
      balance: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
      canRedeemPlus: false,
      canRedeemPro: false,
    }
  }

  const record = pointsRecords.rows[0]
  return {
    balance: record.balance,
    lifetimeEarned: record.lifetime_earned,
    lifetimeSpent: record.lifetime_spent,
    canRedeemPlus: record.balance >= PLUS_COST,
    canRedeemPro: record.balance >= PRO_COST,
    pointsToPlus: Math.max(0, PLUS_COST - record.balance),
    pointsToPro: Math.max(0, PRO_COST - record.balance),
  }
}
