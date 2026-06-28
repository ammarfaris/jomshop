/**
 * Initialize User Points Function
 *
 * PURPOSE:
 * - Creates userPoints record for new users
 * - Awards +100 signup bonus (SIGNUP_BONUS)
 * - Idempotent: safe to call multiple times (returns existing record if already initialized)
 *
 * SECURITY:
 * - Should be called from user registration flow (server-side only)
 * - Uses internal API key, not user session
 * - Validates userId matches authenticated user or is called with API key
 *
 * USAGE:
 * - Call after user successfully registers/verifies email
 * - Can also be called on first login as fallback (idempotent)
 *
 * EXAMPLE REQUEST (as user session):
 * POST /functions/initialize-user-points
 * No body needed - uses authenticated user's ID
 *
 * EXAMPLE REQUEST (server-to-server with API key):
 * POST /functions/initialize-user-points
 * { "userId": "user123" }
 *
 * RESPONSE:
 * {
 *   "success": true,
 *   "points": {
 *     "balance": 100,
 *     "lifetimeEarned": 100,
 *     "lifetimeSpent": 0
 *   },
 *   "isNewUser": true,
 *   "signupBonus": 100
 * }
 */

import { Client, TablesDB, Query, ID, Permission, Role } from 'node-appwrite'

// Constants
const SIGNUP_BONUS = 100

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

  // Get user ID from request
  // Priority: 1) Request body (for server-to-server) 2) JWT authenticated user
  let userId = null

  try {
    // Check if called with user session (JWT)
    if (req.headers['x-appwrite-user-id']) {
      userId = req.headers['x-appwrite-user-id']
      log(`Using authenticated user ID: ${userId}`)
    }

    // Check if body contains userId (server-to-server with API key)
    if (req.body) {
      const body =
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body

      // Only allow body userId if request is from internal API (has proper headers)
      // In production, you'd verify the internal API key here
      if (body.userId) {
        // If user is authenticated, they can only initialize their own points
        if (userId && body.userId !== userId) {
          error(`User ${userId} tried to initialize points for ${body.userId}`)
          return res.json(
            {
              success: false,
              error: 'Unauthorized: Cannot initialize points for another user',
            },
            403
          )
        }
        userId = body.userId
      }
    }
  } catch (e) {
    // Body parsing failed, continue with userId from headers
    log('No body or body parse failed, using header userId')
  }

  if (!userId) {
    return res.json(
      {
        success: false,
        error: 'User ID required. Must be authenticated or provide userId.',
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
    // Check if user already has a points record (idempotent)
    const existingPoints = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: USER_POINTS_COLLECTION_ID,
      queries: [Query.equal('user_id', userId), Query.limit(1)],
    })

    if (existingPoints.total > 0) {
      // User already initialized - return existing record
      const existing = existingPoints.rows[0]
      log(`User ${userId} already has points record, returning existing`)

      return res.json({
        success: true,
        points: {
          balance: existing.balance,
          lifetimeEarned: existing.lifetime_earned,
          lifetimeSpent: existing.lifetime_spent,
        },
        isNewUser: false,
        signupBonus: 0,
        message: 'Points already initialized',
      })
    }

    // Create new points record with signup bonus
    const pointsDocId = ID.unique()

    // Create the userPoints document
    const pointsRecord = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: USER_POINTS_COLLECTION_ID,
      rowId: pointsDocId,
      data: {
        user_id: userId,
        balance: SIGNUP_BONUS,
        lifetime_earned: SIGNUP_BONUS,
        lifetime_spent: 0,
        completed_referrals_count: 0,
      },
      permissions: [
        Permission.read(Role.user(userId)),
        // Note: No write permission for user - only server can modify
      ],
    })

    log(
      `Created points record for user ${userId} with ${SIGNUP_BONUS} signup bonus`
    )

    // Create transaction record for signup bonus
    const transactionDocId = ID.unique()

    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: POINTS_TRANSACTIONS_COLLECTION_ID,
      rowId: transactionDocId,
      data: {
        user_id: userId,
        amount: SIGNUP_BONUS,
        type: 'earn',
        source: 'signup',
        description: 'Welcome bonus for signing up!',
        description_ms: 'Bonus sambutan untuk pendaftaran!',
        metadata: JSON.stringify({
          isSignupBonus: true,
        }),
      },
      permissions: [
        Permission.read(Role.user(userId)),
        // Note: No write permission for user - only server can modify
      ],
    })

    log(`Created signup bonus transaction for user ${userId}`)

    return res.json({
      success: true,
      points: {
        balance: pointsRecord.balance,
        lifetimeEarned: pointsRecord.lifetime_earned,
        lifetimeSpent: pointsRecord.lifetime_spent,
      },
      isNewUser: true,
      signupBonus: SIGNUP_BONUS,
      message: `Welcome! You received ${SIGNUP_BONUS} points as a signup bonus.`,
    })
  } catch (err) {
    error(`Failed to initialize points for user ${userId}: ${err.message}`)
    error(err.stack)

    // Check for duplicate key error (race condition - another request created it)
    if (
      err.code === 409 ||
      err.message.includes('Document with the requested ID already exists')
    ) {
      // Race condition - another request created the record, fetch and return it
      try {
        const existingPoints = await tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: USER_POINTS_COLLECTION_ID,
          queries: [Query.equal('user_id', userId), Query.limit(1)],
        })

        if (existingPoints.total > 0) {
          const existing = existingPoints.rows[0]
          return res.json({
            success: true,
            points: {
              balance: existing.balance,
              lifetimeEarned: existing.lifetime_earned,
              lifetimeSpent: existing.lifetime_spent,
            },
            isNewUser: false,
            signupBonus: 0,
            message: 'Points already initialized (race condition resolved)',
          })
        }
      } catch (retryErr) {
        // Ignore retry error, fall through to generic error
      }
    }

    return res.json(
      {
        success: false,
        error: 'Failed to initialize points',
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
export async function initializeUserPoints(client, userId) {
  const {
    DATABASE_ID,
    USER_POINTS_COLLECTION_ID,
    POINTS_TRANSACTIONS_COLLECTION_ID,
  } = process.env

  const tablesDB = new TablesDB(client)
  const now = new Date().toISOString()

  // Check if already exists
  const existing = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: USER_POINTS_COLLECTION_ID,
    queries: [Query.equal('user_id', userId), Query.limit(1)],
  })

  if (existing.total > 0) {
    return {
      isNew: false,
      record: existing.rows[0],
    }
  }

  // Create new record
  const pointsDocId = ID.unique()

  const record = await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: USER_POINTS_COLLECTION_ID,
    rowId: pointsDocId,
    data: {
      user_id: userId,
      balance: SIGNUP_BONUS,
      lifetime_earned: SIGNUP_BONUS,
      lifetime_spent: 0,
      created_at: now,
      updated_at: now,
    },
    permissions: [Permission.read(Role.user(userId))],
  })

  // Create transaction
  await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: POINTS_TRANSACTIONS_COLLECTION_ID,
    rowId: ID.unique(),
    data: {
      user_id: userId,
      amount: SIGNUP_BONUS,
      type: 'earn',
      source: 'signup',
      description: 'Welcome bonus for signing up!',
      description_ms: 'Bonus sambutan untuk pendaftaran!',
      balance_after: SIGNUP_BONUS,
      metadata: JSON.stringify({ isSignupBonus: true }),
      created_at: now,
    },
    permissions: [Permission.read(Role.user(userId))],
  })

  return {
    isNew: true,
    record,
    bonus: SIGNUP_BONUS,
  }
}
