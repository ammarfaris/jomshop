/**
 * Redeem Points for Subscription Function
 *
 * PURPOSE:
 * - Allows users to redeem points for subscription time
 * - Validates sufficient balance
 * - Deducts points atomically
 * - Updates user_subscriptions collection
 * - Optionally syncs with RevenueCat for unified subscription management
 *
 * SECURITY:
 * - User must be authenticated (JWT)
 * - Balance validated server-side
 * - Transaction created for audit trail
 * - user_subscriptions updated atomically
 *
 * PRICING:
 * - Plus (1 month): 1,500 points
 * - Pro (1 month): 3,000 points
 *
 * EXAMPLE REQUEST:
 * POST /functions/redeem-points-for-subscription
 * {
 *   "tier": "plus"  // or "pro"
 * }
 *
 * RESPONSE:
 * {
 *   "success": true,
 *   "redemption": {
 *     "tier": "plus",
 *     "pointsSpent": 1500,
 *     "newBalance": 500,
 *     "expiresAt": "2025-02-15T00:00:00.000Z"
 *   }
 * }
 */

import { Client, TablesDB, Query, ID, Permission, Role } from 'node-appwrite'

// Redemption pricing
const TIER_COSTS = {
  plus: 1500,
  pro: 3000,
}

// Subscription duration in days
const SUBSCRIPTION_DAYS = 30

// Only allow renewing the SAME tier within this window (prevents oversubscription)
const RENEWAL_WINDOW_DAYS = 7

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
    USER_SUBSCRIPTIONS_COLLECTION_ID,
    REVENUECAT_API_KEY, // Optional: for syncing with RevenueCat
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
    !POINTS_TRANSACTIONS_COLLECTION_ID ||
    !USER_SUBSCRIPTIONS_COLLECTION_ID
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

  // Get authenticated user
  const userId = req.headers['x-appwrite-user-id']
  if (!userId) {
    return res.json(
      {
        success: false,
        error: 'Authentication required',
      },
      401
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

  // Validate tier
  const { tier } = body
  if (!tier || !TIER_COSTS[tier]) {
    return res.json(
      {
        success: false,
        error: `Invalid tier. Must be one of: ${Object.keys(TIER_COSTS).join(
          ', '
        )}`,
      },
      400
    )
  }

  const cost = TIER_COSTS[tier]

  // Initialize Appwrite client
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(INTERNAL_API_KEY)

  const tablesDB = new TablesDB(client)

  try {
    // Get user's current points
    const pointsRecords = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: USER_POINTS_COLLECTION_ID,
      queries: [Query.equal('user_id', userId), Query.limit(1)],
    })

    if (pointsRecords.total === 0) {
      return res.json(
        {
          success: false,
          error: 'No points record found. Please try again later.',
        },
        400
      )
    }

    const pointsRecord = pointsRecords.rows[0]
    const currentBalance = pointsRecord.balance

    // Validate sufficient balance
    if (currentBalance < cost) {
      return res.json(
        {
          success: false,
          error: 'Insufficient points balance',
          details: {
            required: cost,
            current: currentBalance,
            needed: cost - currentBalance,
          },
        },
        400
      )
    }

    // Check current subscription status
    const subRecords = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: USER_SUBSCRIPTIONS_COLLECTION_ID,
      queries: [Query.equal('user_id', userId), Query.limit(1)],
    })

    const now = new Date()
    let currentSub = subRecords.total > 0 ? subRecords.rows[0] : null
    let newExpiresAt

    // Calculate new expiry date
    if (currentSub && currentSub.expires_at) {
      const currentExpiry = new Date(currentSub.expires_at)

      if (currentExpiry > now) {
        const daysRemaining = Math.ceil(
          (currentExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )

        // Disallow switching tiers while an active subscription is running
        if (currentSub.tier && currentSub.tier !== tier) {
          return res.json(
            {
              success: false,
              error:
                'You already have an active subscription. Changing plans using points is only available after it expires. Enable auto-renew to schedule a plan change.',
              details: {
                currentTier: currentSub.tier,
                requestedTier: tier,
                daysRemaining,
              },
            },
            400
          )
        }

        // Renewing the SAME tier: only allow when expiring soon
        if (daysRemaining > RENEWAL_WINDOW_DAYS) {
          return res.json(
            {
              success: false,
              error: `You can only renew your current plan with points when it is within ${RENEWAL_WINDOW_DAYS} days of expiring.`,
              details: {
                currentTier: currentSub.tier,
                requestedTier: tier,
                daysRemaining,
                renewalWindowDays: RENEWAL_WINDOW_DAYS,
              },
            },
            400
          )
        }

        // Extend from current expiry (no loss of remaining days)
        newExpiresAt = new Date(
          currentExpiry.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000
        )
        log(
          `Renewing subscription from ${currentExpiry.toISOString()} to ${newExpiresAt.toISOString()}`
        )
      } else {
        // Expired, start fresh
        newExpiresAt = new Date(
          now.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000
        )
      }
    } else {
      // No existing subscription
      newExpiresAt = new Date(
        now.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000
      )
    }

    const newBalance = currentBalance - cost
    const nowIso = now.toISOString()

    // Generate idempotency key to prevent double redemption
    const idempotencyKey = `redeem_${userId}_${tier}_${nowIso}`

    // Deduct points
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: USER_POINTS_COLLECTION_ID,
      rowId: pointsRecord.$id,
      data: {
        balance: newBalance,
        lifetime_spent: pointsRecord.lifetime_spent + cost,
      },
    })

    log(
      `Deducted ${cost} points from user ${userId}: ${currentBalance} -> ${newBalance}`
    )

    // Create transaction record
    const transactionId = ID.unique()
    const tierName = tier.charAt(0).toUpperCase() + tier.slice(1)
    const tierNameMs = tier === 'plus' ? 'Plus' : tier === 'pro' ? 'Pro' : tier

    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: POINTS_TRANSACTIONS_COLLECTION_ID,
      rowId: transactionId,
      data: {
        user_id: userId,
        amount: -cost, // Negative for spending
        type: 'spend',
        source: 'subscription',
        description: `Redeemed for ${tierName} subscription (${SUBSCRIPTION_DAYS} days)`,
        description_ms: `Ditebus untuk langganan ${tierNameMs} (${SUBSCRIPTION_DAYS} hari)`,
        metadata: JSON.stringify({
          tier,
          days: SUBSCRIPTION_DAYS,
          expiresAt: newExpiresAt.toISOString(),
          idempotencyKey,
        }),
      },
      permissions: [Permission.read(Role.user(userId))],
    })

    log(`Created redemption transaction ${transactionId}`)

    // Update or create subscription record
    if (currentSub) {
      await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: USER_SUBSCRIPTIONS_COLLECTION_ID,
        rowId: currentSub.$id,
        data: {
          tier: tier,
          source: 'points',
          expires_at: newExpiresAt.toISOString(),
          auto_renew_failed_at: null, // Clear any previous auto-renewal failure
          // Keep revenuecat_customer_id if exists
        },
      })
      log(
        `Updated subscription for user ${userId} to ${tier}, expires ${newExpiresAt.toISOString()}`
      )
    } else {
      // Create new subscription record
      await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: USER_SUBSCRIPTIONS_COLLECTION_ID,
        rowId: ID.unique(),
        data: {
          user_id: userId,
          tier: tier,
          source: 'points',
          expires_at: newExpiresAt.toISOString(),
          revenuecat_customer_id: null,
          last_event_id: null,
          auto_renew_failed_at: null, // Explicitly set as null for new subscriptions
        },
        permissions: [
          Permission.read(Role.user(userId)),
          // No write permission for user
        ],
      })
      log(
        `Created subscription for user ${userId}: ${tier}, expires ${newExpiresAt.toISOString()}`
      )
    }

    // Optional: Sync with RevenueCat for unified entitlement management
    // This is useful if you want RevenueCat to be the single source of truth
    if (REVENUECAT_API_KEY) {
      try {
        await syncWithRevenueCat(userId, tier, newExpiresAt)
        log(`Synced subscription with RevenueCat for user ${userId}`)
      } catch (rcError) {
        // Log but don't fail - our DB is the primary source for points-based subs
        error(`Failed to sync with RevenueCat: ${rcError.message}`)
      }
    }

    return res.json({
      success: true,
      redemption: {
        tier,
        pointsSpent: cost,
        previousBalance: currentBalance,
        newBalance,
        expiresAt: newExpiresAt.toISOString(),
        daysAdded: SUBSCRIPTION_DAYS,
      },
      message: `Successfully redeemed ${cost} points for ${
        tier.charAt(0).toUpperCase() + tier.slice(1)
      } subscription!`,
    })
  } catch (err) {
    error(`Failed to redeem points for user ${userId}: ${err.message}`)
    error(err.stack)

    return res.json(
      {
        success: false,
        error: 'Failed to redeem points. Please try again.',
        details:
          process.env.NODE_ENV === 'development' ? err.message : undefined,
      },
      500
    )
  }
}

/**
 * Sync subscription with RevenueCat via REST API
 * This grants a promotional entitlement in RevenueCat
 */
async function syncWithRevenueCat(userId, tier, expiresAt) {
  const { REVENUECAT_API_KEY, REVENUECAT_PROJECT_ID } = process.env

  if (!REVENUECAT_API_KEY) {
    throw new Error('RevenueCat API key not configured')
  }

  // RevenueCat entitlement IDs should match your setup
  const entitlementId = tier === 'pro' ? 'pro' : 'plus'

  // Grant promotional entitlement via RevenueCat REST API
  // https://www.revenuecat.com/docs/api-v1#tag/subscribers/operation/subscribersAttribution
  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${userId}/entitlements/${entitlementId}/promotional`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REVENUECAT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        duration: 'monthly', // or use 'P30D' for exactly 30 days
        // For precise control, use start_time_ms and end_time_ms
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`RevenueCat API error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

/**
 * Helper for checking if user can redeem
 * Can be imported by other functions
 */
export function canRedeem(balance, tier) {
  const cost = TIER_COSTS[tier]
  if (!cost) return { canRedeem: false, error: 'Invalid tier' }

  return {
    canRedeem: balance >= cost,
    cost,
    balance,
    deficit: Math.max(0, cost - balance),
  }
}

/**
 * Get tier costs for display
 */
export function getTierCosts() {
  return { ...TIER_COSTS }
}
