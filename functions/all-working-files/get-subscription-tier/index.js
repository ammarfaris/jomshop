/**
 * Get Subscription Tier
 *
 * Securely retrieves user's subscription tier from the server-controlled
 * user_subscriptions collection. This function should be called by the client
 * to get the current tier, and by other server functions to verify access.
 *
 * Environment Variables Required:
 * - APPWRITE_ENDPOINT
 * - APPWRITE_PROJECT_ID
 * - INTERNAL_API_KEY
 * - DATABASE_ID
 * - USER_SUBSCRIPTIONS_COLLECTION_ID
 *
 * Request Body:
 * - userId: string (optional if calling with authenticated session)
 *
 * Response:
 * - tier: 'free' | 'plus' | 'pro'
 * - source: 'none' | 'money' | 'points'
 * - expiresAt: ISO date string | null
 * - isActive: boolean (true if tier is not free)
 * - daysRemaining: number | null
 * - autoRenew: boolean (true if user wants auto-renew with points)
 * - autoRenewNextTier: 'plus' | 'pro' | null (which tier to renew into when auto-renew runs)
 */

const { Client, TablesDB, Query, Users } = require('node-appwrite')

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  INTERNAL_API_KEY,
  DATABASE_ID,
  USER_SUBSCRIPTIONS_COLLECTION_ID,
} = process.env

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(INTERNAL_API_KEY)

const tablesDB = new TablesDB(client)
const users = new Users(client)

/**
 * Tier feature limits configuration
 */
const TIER_LIMITS = {
  free: {
    maxContestsWithReceipts: 5,
    maxReceiptsPerContest: 3,
    canChangeColorTheme: false,
    hasReducedAds: false,
    hasNoAds: false,
    hasPrioritySupport: false,
  },
  plus: {
    maxContestsWithReceipts: -1, // unlimited
    maxReceiptsPerContest: 10,
    canChangeColorTheme: true,
    hasReducedAds: true,
    hasNoAds: false,
    hasPrioritySupport: false,
  },
  pro: {
    maxContestsWithReceipts: -1, // unlimited
    maxReceiptsPerContest: -1, // unlimited
    canChangeColorTheme: true,
    hasReducedAds: true,
    hasNoAds: true,
    hasPrioritySupport: true,
  },
}

/**
 * Calculate days remaining until expiration
 */
function calculateDaysRemaining(expiresAt) {
  if (!expiresAt) return null

  const now = new Date()
  const expiry = new Date(expiresAt)
  const diffMs = expiry.getTime() - now.getTime()

  if (diffMs <= 0) return 0

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Check if subscription is expired
 */
function isExpired(expiresAt) {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

/**
 * Get user subscription from database
 */
async function getUserSubscription(userId) {
  try {
    // Query by user_id field
    const result = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: USER_SUBSCRIPTIONS_COLLECTION_ID,
      queries: [Query.equal('user_id', userId), Query.limit(1)],
    })

    if (result.total === 0) {
      return null
    }

    return result.rows[0]
  } catch (error) {
    // Log the error to help debug
    console.error('Failed to fetch subscription:', error.message, error.code)
    // If query fails, return null to use free tier
    return null
  }
}

/**
 * Main handler
 */
module.exports = async ({ req, res, log, error }) => {
  try {
    // Get user ID from JWT or request body
    let userId = null

    // If called with JWT authentication, extract user ID
    if (req.headers['x-appwrite-user-id']) {
      userId = req.headers['x-appwrite-user-id']
    }

    // Or from request body (for server-to-server calls)
    if (!userId && req.body) {
      const body =
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      userId = body.userId
    }

    if (!userId) {
      return res.json({ error: 'User ID required' }, 400)
    }

    log(`Fetching subscription for user: ${userId}`)

    // Verify user exists (optional security check)
    try {
      await users.get(userId)
    } catch (userError) {
      if (userError.code === 404) {
        return res.json({ error: 'User not found' }, 404)
      }
      // Continue even if user check fails - might be anonymous
    }

    // Get subscription from database
    const subscription = await getUserSubscription(userId)

    log(`Subscription query result: ${subscription ? 'found' : 'not found'}`)
    if (subscription) {
      log(
        `Subscription details: tier=${subscription.tier}, source=${subscription.source}, expires=${subscription.expires_at}`
      )
    }

    // Default response for users without subscription record
    if (!subscription) {
      return res.json({
        success: true,
        subscription: {
          tier: 'free',
          source: 'none',
          expiresAt: null,
          isActive: false,
          daysRemaining: null,
          autoRenew: false,
          autoRenewNextTier: null,
          autoRenewFailedAt: null,
          autoRenewFailedDismissed: false,
          autoRenewAdjustedAt: null,
          autoRenewAdjustedDismissed: false,
        },
        limits: TIER_LIMITS.free,
        expiringSoon: false,
      })
    }

    // Check if subscription is expired
    let tier = subscription.tier || 'free'
    let source = subscription.source || 'none'
    const expiresAt = subscription.expires_at || null

    if (tier !== 'free' && isExpired(expiresAt)) {
      // Subscription has expired - treat as free
      // Note: The revenuecat-webhook should have updated this,
      // but this is a safety fallback
      tier = 'free'
      source = 'none'
      log(`Subscription expired for user ${userId} - treating as free`)
    }

    const daysRemaining = calculateDaysRemaining(expiresAt)

    return res.json({
      success: true,
      subscription: {
        tier,
        source,
        expiresAt,
        isActive: tier !== 'free',
        daysRemaining,
        autoRenew: subscription.auto_renew || false,
        autoRenewNextTier: subscription.auto_renew_next_tier || null,
        autoRenewFailedAt: subscription.auto_renew_failed_at || null,
        autoRenewFailedDismissed: subscription.auto_renew_failed_dismissed || false,
        autoRenewAdjustedAt: subscription.auto_renew_adjusted_at || null,
        autoRenewAdjustedDismissed: subscription.auto_renew_adjusted_dismissed || false,
      },
      limits: TIER_LIMITS[tier] || TIER_LIMITS.free,
      // Include warning if expiring soon (7 days)
      expiringSoon:
        daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0,
    })
  } catch (err) {
    error('Error getting subscription tier: ' + err.message)
    return res.json({ error: 'Failed to get subscription' }, 500)
  }
}

/**
 * Helper function for other server functions to call directly
 * (Not exposed via HTTP, used when importing this module)
 */
module.exports.getSubscriptionTier = async (userId) => {
  const subscription = await getUserSubscription(userId)

  if (!subscription) {
    return {
      tier: 'free',
      limits: TIER_LIMITS.free,
    }
  }

  let tier = subscription.tier || 'free'
  const expiresAt = subscription.expires_at || null

  if (tier !== 'free' && isExpired(expiresAt)) {
    tier = 'free'
  }

  return {
    tier,
    limits: TIER_LIMITS[tier] || TIER_LIMITS.free,
    expiresAt,
  }
}

module.exports.TIER_LIMITS = TIER_LIMITS
