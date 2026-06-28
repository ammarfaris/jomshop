/**
 * Award Points Function
 *
 * PURPOSE:
 * - Awards points to users from various sources
 * - Creates transaction records for audit trail
 * - Updates user balance atomically
 *
 * SECURITY:
 * - SERVER-SIDE ONLY: This function should only be called by other server functions
 * - Validates source against allowed sources
 * - Validates amount within acceptable ranges
 * - Uses internal API key for database operations
 *
 * SOURCES:
 * - referral: +200 points when referee uploads first receipt
 * - affiliate: Variable points from affiliate purchases
 * - admin: Manual admin grants (with reason required)
 * - receipt: Future use for receipt milestones
 *
 * EXAMPLE REQUEST (server-to-server):
 * POST /functions/award-points
 * {
 *   "userId": "user123",
 *   "amount": 200,
 *   "source": "referral",
 *   "description": "Referral bonus: John uploaded their first receipt",
 *   "metadata": {
 *     "refereeUserId": "referee456",
 *     "receiptId": "receipt789"
 *   }
 * }
 *
 * RESPONSE:
 * {
 *   "success": true,
 *   "points": {
 *     "previousBalance": 100,
 *     "awarded": 200,
 *     "newBalance": 300
 *   },
 *   "transactionId": "txn_abc123"
 * }
 */

import {
  Client,
  TablesDB,
  Query,
  ID,
  Permission,
  Role,
  Teams,
  Users,
} from 'node-appwrite'

// Valid sources and their point limits
const SOURCE_CONFIG = {
  referral: {
    minAmount: 200,
    maxAmount: 200,
    requiresRefereeId: true,
  },
  affiliate: {
    minAmount: 1,
    maxAmount: 1000,
    requiresOrderId: true,
  },
  admin: {
    minAmount: -5000,
    maxAmount: 5000,
    requiresReason: true,
    requiresAdminId: true,
  },
  receipt: {
    minAmount: 1,
    maxAmount: 100,
    requiresMilestone: true,
  },
  bonus: {
    minAmount: 1,
    maxAmount: 500,
    requiresReason: true,
  },
}

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

  // Initialize Appwrite client with API key (needed for admin checks)
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(INTERNAL_API_KEY)

  // Verify internal API key (server-to-server auth) OR admin user
  // This prevents regular users from calling this endpoint directly
  const authHeader =
    req.headers['x-internal-api-key'] || req.headers['authorization']
  const hasInternalKey =
    INTERNAL_API_KEY && authHeader === `Bearer ${INTERNAL_API_KEY}`
  const isFunctionCall = req.headers['x-appwrite-function-id']
  const requestingUserId = req.headers['x-appwrite-user-id'] // User ID from authenticated session (set by Appwrite, cannot be spoofed)

  log(
    `Auth check - hasInternalKey: ${!!hasInternalKey}, isFunctionCall: ${!!isFunctionCall}, requestingUserId: ${
      requestingUserId || 'none'
    }`
  )

  // Check if user is admin (only needed if not using internal key or function call)
  let isAdmin = false
  if (!hasInternalKey && !isFunctionCall && requestingUserId) {
    try {
      const teams = new Teams(client)
      const ADMIN_TEAM_ID = process.env.ADMIN_TEAM_ID || 'admin'

      log(
        `Checking if user ${requestingUserId} is in admin team ${ADMIN_TEAM_ID}`
      )

      // Check if user is in admin team
      const memberships = await teams.listMemberships(ADMIN_TEAM_ID, [
        Query.equal('userId', requestingUserId),
      ])
      isAdmin = memberships.memberships.length > 0

      log(
        `Admin check result: ${isAdmin} (${memberships.memberships.length} memberships found)`
      )
    } catch (err) {
      log(`Admin check failed: ${err.message}`)
    }
  }

  // Require either internal key, function call, or admin user
  if (!hasInternalKey && !isFunctionCall && !isAdmin) {
    error(
      `Unauthorized: Missing internal API key, function context, or admin access. User: ${
        requestingUserId || 'none'
      }`
    )
    return res.json(
      {
        success: false,
        error: 'Unauthorized',
      },
      403
    )
  }

  // Parse request body
  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch (e) {
    return res.json(
      {
        success: false,
        error: 'Invalid JSON body',
      },
      400
    )
  }

  // Validate required fields
  const {
    userId,
    amount,
    source,
    description,
    description_ms,
    metadata,
    idempotencyKey,
  } = body

  if (!userId) {
    return res.json(
      {
        success: false,
        error: 'userId is required',
      },
      400
    )
  }

  if (typeof amount !== 'number' || amount === 0) {
    return res.json(
      {
        success: false,
        error: 'amount must be a non-zero number',
      },
      400
    )
  }

  if (!source || !SOURCE_CONFIG[source]) {
    return res.json(
      {
        success: false,
        error: `Invalid source. Must be one of: ${Object.keys(
          SOURCE_CONFIG
        ).join(', ')}`,
      },
      400
    )
  }

  // Validate amount against source limits
  const sourceConfig = SOURCE_CONFIG[source]
  if (amount < sourceConfig.minAmount || amount > sourceConfig.maxAmount) {
    return res.json(
      {
        success: false,
        error: `Amount for ${source} must be between ${sourceConfig.minAmount} and ${sourceConfig.maxAmount}`,
      },
      400
    )
  }

  // Validate source-specific requirements
  const parsedMetadata = metadata
    ? typeof metadata === 'string'
      ? JSON.parse(metadata)
      : metadata
    : {}

  if (sourceConfig.requiresRefereeId && !parsedMetadata.refereeUserId) {
    return res.json(
      {
        success: false,
        error: 'Referral points require refereeUserId in metadata',
      },
      400
    )
  }

  if (sourceConfig.requiresOrderId && !parsedMetadata.orderId) {
    return res.json(
      {
        success: false,
        error: 'Affiliate points require orderId in metadata',
      },
      400
    )
  }

  if (sourceConfig.requiresAdminId && !parsedMetadata.adminUserId) {
    return res.json(
      {
        success: false,
        error: 'Admin points require adminUserId in metadata',
      },
      400
    )
  }

  if (sourceConfig.requiresReason && !description) {
    return res.json(
      {
        success: false,
        error: 'This source requires a description/reason',
      },
      400
    )
  }

  const tablesDB = new TablesDB(client)

  try {
    // VALIDATE: Check if user exists in Appwrite
    const users = new Users(client)

    try {
      await users.get(userId)
      log(`User validation passed for ${userId}`)
    } catch (userError) {
      if (userError.code === 404) {
        error(`User not found: ${userId}`)
        return res.json(
          {
            success: false,
            error: `User ${userId} does not exist`,
          },
          404
        )
      }
      // For other errors, log but continue (might be permission issue)
      log(`Warning: Could not validate user: ${userError.message}`)
    }

    // Check for idempotency (prevent duplicate awards)
    if (idempotencyKey) {
      const existingTxn = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: POINTS_TRANSACTIONS_COLLECTION_ID,
        queries: [
          Query.equal('user_id', userId),
          Query.contains('metadata', idempotencyKey),
          Query.limit(1),
        ],
      })

      if (existingTxn.total > 0) {
        log(`Duplicate award request detected: ${idempotencyKey}`)
        // Fetch current balance for the user
        const currentPoints = await tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: USER_POINTS_COLLECTION_ID,
          queries: [Query.equal('user_id', userId), Query.limit(1)],
        })
        const currentBalance = currentPoints.rows[0]?.balance || 0
        return res.json({
          success: true,
          points: {
            previousBalance: currentBalance - amount,
            awarded: amount,
            newBalance: currentBalance,
          },
          transactionId: existingTxn.rows[0].$id,
          isDuplicate: true,
          message: 'Points already awarded (idempotent)',
        })
      }
    }

    // Get user's current points record
    const pointsRecords = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: USER_POINTS_COLLECTION_ID,
      queries: [Query.equal('user_id', userId), Query.limit(1)],
    })

    let pointsRecord
    const now = new Date().toISOString()

    if (pointsRecords.total === 0) {
      // User doesn't have points record - create one (shouldn't happen normally)
      log(`User ${userId} has no points record, creating one`)

      pointsRecord = await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: USER_POINTS_COLLECTION_ID,
        rowId: ID.unique(),
        data: {
          user_id: userId,
          balance: 0,
          lifetime_earned: 0,
          lifetime_spent: 0,
          completed_referrals_count: 0,
        },
        permissions: [Permission.read(Role.user(userId))],
      })
    } else {
      pointsRecord = pointsRecords.rows[0]
    }

    const previousBalance = pointsRecord.balance
    const newBalance = previousBalance + amount

    // Prepare update data
    const updateData = {
      balance: newBalance,
    }

    // Update lifetime stats based on amount sign
    if (amount > 0) {
      updateData.lifetime_earned = (pointsRecord.lifetime_earned || 0) + amount
    } else {
      updateData.lifetime_spent =
        (pointsRecord.lifetime_spent || 0) + Math.abs(amount)
    }

    // Update points record
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: USER_POINTS_COLLECTION_ID,
      rowId: pointsRecord.$id,
      data: updateData,
    })

    log(
      `Updated points for user ${userId}: ${previousBalance} + ${amount} = ${newBalance}`
    )

    // Create transaction record
    const transactionId = ID.unique()
    const transactionMetadata = {
      ...parsedMetadata,
      idempotencyKey: idempotencyKey || null,
    }

    const transactionData = {
      user_id: userId,
      amount: amount,
      type: amount > 0 ? 'earn' : 'spend',
      source: source,
      description: description || getDefaultDescription(source, amount),
      metadata: JSON.stringify(transactionMetadata),
    }

    // Add Malay description if provided
    if (description_ms) {
      transactionData.description_ms = description_ms
    }

    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: POINTS_TRANSACTIONS_COLLECTION_ID,
      rowId: transactionId,
      data: transactionData,
      permissions: [Permission.read(Role.user(userId))],
    })

    log(`Created transaction ${transactionId} for ${source} +${amount} points`)

    return res.json({
      success: true,
      points: {
        previousBalance,
        awarded: amount,
        newBalance,
      },
      transactionId,
      message: `Successfully awarded ${amount} points`,
    })
  } catch (err) {
    error(`Failed to award points to user ${userId}: ${err.message}`)
    error(err.stack)

    return res.json(
      {
        success: false,
        error: 'Failed to award points',
        details:
          process.env.NODE_ENV === 'development' ? err.message : undefined,
      },
      500
    )
  }
}

/**
 * Get default description for a source
 */
function getDefaultDescription(source, amount) {
  const prefix = amount > 0 ? '+' : ''
  const descriptions = {
    referral: `Referral bonus: ${prefix}${amount} points`,
    affiliate: `Affiliate purchase bonus: ${prefix}${amount} points`,
    admin: `Admin adjustment: ${prefix}${amount} points`,
    receipt: `Receipt milestone: ${prefix}${amount} points`,
    bonus: `Bonus: ${prefix}${amount} points`,
  }
  return descriptions[source] || `${prefix}${amount} points`
}

/**
 * Helper function for server-to-server calls
 * Can be imported by other functions
 */
export async function awardPoints(
  client,
  {
    userId,
    amount,
    source,
    description,
    description_ms,
    metadata,
    idempotencyKey,
  }
) {
  const {
    DATABASE_ID,
    USER_POINTS_COLLECTION_ID,
    POINTS_TRANSACTIONS_COLLECTION_ID,
  } = process.env

  const tablesDB = new TablesDB(client)
  const now = new Date().toISOString()

  // Validate source
  if (!SOURCE_CONFIG[source]) {
    throw new Error(`Invalid source: ${source}`)
  }

  // Check idempotency
  if (idempotencyKey) {
    const existingTxn = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: POINTS_TRANSACTIONS_COLLECTION_ID,
      queries: [
        Query.equal('user_id', userId),
        Query.contains('metadata', idempotencyKey),
        Query.limit(1),
      ],
    })

    if (existingTxn.total > 0) {
      return {
        success: true,
        isDuplicate: true,
        transactionId: existingTxn.rows[0].$id,
        newBalance: existingTxn.rows[0].balance_after,
      }
    }
  }

  // Get or create points record
  let pointsRecords = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: USER_POINTS_COLLECTION_ID,
    queries: [Query.equal('user_id', userId), Query.limit(1)],
  })

  let pointsRecord
  if (pointsRecords.total === 0) {
    pointsRecord = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: USER_POINTS_COLLECTION_ID,
      rowId: ID.unique(),
      data: {
        user_id: userId,
        balance: 0,
        lifetime_earned: 0,
        lifetime_spent: 0,
        created_at: now,
        updated_at: now,
      },
      permissions: [Permission.read(Role.user(userId))],
    })
  } else {
    pointsRecord = pointsRecords.rows[0]
  }

  const previousBalance = pointsRecord.balance
  const newBalance = previousBalance + amount

  // Prepare update data
  const updateData = {
    balance: newBalance,
    updated_at: now,
  }

  // Update lifetime stats based on amount sign
  if (amount > 0) {
    updateData.lifetime_earned = (pointsRecord.lifetime_earned || 0) + amount
  } else {
    updateData.lifetime_spent =
      (pointsRecord.lifetime_spent || 0) + Math.abs(amount)
  }

  // Update balance
  await tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: USER_POINTS_COLLECTION_ID,
    rowId: pointsRecord.$id,
    data: updateData,
  })

  // Create transaction
  const transactionId = ID.unique()
  const transactionData = {
    user_id: userId,
    amount,
    type: amount > 0 ? 'earn' : 'spend',
    source,
    description: description || getDefaultDescription(source, amount),
    balance_after: newBalance,
    metadata: JSON.stringify({ ...metadata, idempotencyKey }),
    created_at: now,
  }

  // Add Malay description if provided
  if (description_ms) {
    transactionData.description_ms = description_ms
  }

  await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: POINTS_TRANSACTIONS_COLLECTION_ID,
    rowId: transactionId,
    data: transactionData,
    permissions: [Permission.read(Role.user(userId))],
  })

  return {
    success: true,
    isDuplicate: false,
    transactionId,
    previousBalance,
    newBalance,
  }
}
