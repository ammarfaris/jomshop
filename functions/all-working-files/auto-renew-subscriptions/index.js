/**
 * Auto-Renew Subscriptions Function (CRON)
 *
 * PURPOSE:
 * - Automatically renews subscriptions for users with auto_renew enabled
 * - Runs as a scheduled cron job (recommended: every hour)
 * - Checks subscriptions expiring in the next hour and renews them early
 * - Deducts points and updates expiration date
 * - Disables auto_renew if insufficient points
 *
 * LOGIC:
 * - Query subscriptions where:
 *   - auto_renew = true
 *   - expires_at is within the next hour (renew before expiry, no gaps)
 * - For each subscription:
 *   - Check user has sufficient points
 *   - If sufficient: deduct points, extend expiry by 30 days
 *   - If insufficient: set auto_renew = false, log failure
 *
 * SCHEDULE:
 * - Recommended CRON: "0 * * * *" (every hour at minute 0)
 *
 * SECURITY:
 * - This function should only be triggered by CRON/schedule
 * - Uses API key for admin access
 *
 * RESPONSE:
 * {
 *   "success": true,
 *   "processed": 5,
 *   "renewed": 3,
 *   "failed": 2,
 *   "details": [...]
 * }
 */

import { Client, TablesDB, Query, ID, Permission, Role } from 'node-appwrite'

// Redemption pricing (must match redeem-points-for-subscription)
const TIER_COSTS = {
  plus: 1500,
  pro: 3000,
}

// Subscription duration in days
const SUBSCRIPTION_DAYS = 30

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

  // Initialize Appwrite client with API key
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(INTERNAL_API_KEY)

  const tablesDB = new TablesDB(client)

  const now = new Date()
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

  log(`[AutoRenew] Starting auto-renewal check at ${now.toISOString()}`)
  log(
    `[AutoRenew] Looking for subscriptions expiring before ${oneHourFromNow.toISOString()} or already expired`
  )

  const results = {
    processed: 0,
    renewed: 0,
    failed: 0,
    details: [],
  }

  try {
    // Query subscriptions that:
    // 1. Have auto_renew enabled
    // 2. Are expiring within the next hour OR already expired
    const subscriptions = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: USER_SUBSCRIPTIONS_COLLECTION_ID,
      queries: [
        Query.equal('auto_renew', true),
        Query.lessThanEqual('expires_at', oneHourFromNow.toISOString()),
        // Removed greaterThan check - now includes already expired subscriptions
        Query.limit(100), // Process up to 100 per run
      ],
    })

    log(`[AutoRenew] Found ${subscriptions.total} subscriptions to process`)

    for (const sub of subscriptions.rows) {
      results.processed++

      const userId = sub.user_id
      const currentTier = sub.tier
      const requestedTier = sub.auto_renew_next_tier || currentTier
      const currentExpiresAt = new Date(sub.expires_at)
      const requestedCost = TIER_COSTS[requestedTier]

      if (!requestedCost) {
        log(
          `[AutoRenew] Skipping user ${userId}: unknown requested tier "${requestedTier}"`
        )
        results.details.push({
          userId,
          status: 'skipped',
          reason: `Unknown tier: ${requestedTier}`,
        })
        continue
      }

      log(
        `[AutoRenew] Processing user ${userId}, current tier: ${currentTier}, requested tier: ${requestedTier}, cost: ${requestedCost}`
      )

      try {
        // Get user's points balance
        const pointsRecords = await tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: USER_POINTS_COLLECTION_ID,
          queries: [Query.equal('user_id', userId), Query.limit(1)],
        })

        if (pointsRecords.total === 0) {
          // No points record - disable auto-renew
          log(
            `[AutoRenew] User ${userId} has no points record, disabling auto-renew`
          )
          await disableAutoRenew(
            tablesDB,
            DATABASE_ID,
            USER_SUBSCRIPTIONS_COLLECTION_ID,
            sub.$id,
            userId
          )
          results.failed++
          results.details.push({
            userId,
            status: 'failed',
            reason: 'No points record found',
          })
          continue
        }

        const pointsRecord = pointsRecords.rows[0]
        const currentBalance = pointsRecord.balance

        // Determine which tier we can actually renew (fallback to lower tier if needed)
        let renewedTier = requestedTier
        let renewedCost = requestedCost
        let wasAdjusted = false

        if (currentBalance < requestedCost) {
          // If user requested Pro but can't afford it, try falling back to Plus
          if (requestedTier === 'pro' && currentBalance >= TIER_COSTS.plus) {
            renewedTier = 'plus'
            renewedCost = TIER_COSTS.plus
            wasAdjusted = true
            log(
              `[AutoRenew] User ${userId} has insufficient points for Pro (${currentBalance} < ${requestedCost}), falling back to Plus (${renewedCost})`
            )
          } else {
            // Insufficient points for any renewal - disable auto-renew
            log(
              `[AutoRenew] User ${userId} has insufficient points (${currentBalance} < ${requestedCost}), disabling auto-renew`
            )
            await disableAutoRenew(
              tablesDB,
              DATABASE_ID,
              USER_SUBSCRIPTIONS_COLLECTION_ID,
              sub.$id,
              userId
            )
            results.failed++
            results.details.push({
              userId,
              status: 'failed',
              reason: `Insufficient points (${currentBalance}/${requestedCost})`,
            })
            continue
          }
        }

        // Calculate new expiry date
        // If already expired, extend from now
        // If not yet expired, extend from current expiry
        const baseDate = currentExpiresAt < now ? now : currentExpiresAt
        const newExpiresAt = new Date(baseDate)
        newExpiresAt.setDate(newExpiresAt.getDate() + SUBSCRIPTION_DAYS)

        // Deduct points
        const newBalance = currentBalance - renewedCost
        await tablesDB.updateRow({
          databaseId: DATABASE_ID,
          tableId: USER_POINTS_COLLECTION_ID,
          rowId: pointsRecord.$id,
          data: {
            balance: newBalance,
          },
        })

        // Create transaction record
        await tablesDB.createRow({
          databaseId: DATABASE_ID,
          tableId: POINTS_TRANSACTIONS_COLLECTION_ID,
          rowId: ID.unique(),
          data: {
            user_id: userId,
            amount: -renewedCost, // Negative for spending
            type: 'spend',
            source: 'subscription',
            description: `Auto-renewal: ${renewedTier} subscription (${SUBSCRIPTION_DAYS} days)${
              wasAdjusted ? ' (adjusted due to insufficient points)' : ''
            }`,
            description_ms: `Perpanjangan automatik: langganan ${
              renewedTier === 'plus' ? 'Plus' : 'Pro'
            } (${SUBSCRIPTION_DAYS} hari)${
              wasAdjusted ? ' (diselaraskan kerana poin tidak mencukupi)' : ''
            }`,
            metadata: JSON.stringify({
              tier: renewedTier,
              requestedTier,
              days: SUBSCRIPTION_DAYS,
              expiresAt: newExpiresAt.toISOString(),
              autoRenewal: true,
              adjusted: wasAdjusted,
            }),
          },
          permissions: [Permission.read(Role.user(userId))],
        })

        // Update subscription expiry
        // - auto_renew_failed_at: ONLY set when renewal completely fails (insufficient points for ANY tier)
        // - auto_renew_adjusted_at: Set when renewal succeeds but at a lower tier than requested
        // - dismissed flags: Reset to false when clearing timestamps to maintain clean state
        const updatePayload = {
          expires_at: newExpiresAt.toISOString(),
          source: 'points', // Renewed via points
          tier: renewedTier,
          // Clear failed state on successful renewal - reset dismissed flag for clean state
          auto_renew_failed_at: null,
          auto_renew_failed_dismissed: false,
        }

        if (wasAdjusted) {
          // NEW adjustment happened - set timestamp and reset dismissed flag so alert shows
          updatePayload.auto_renew_adjusted_at = new Date().toISOString()
          updatePayload.auto_renew_adjusted_dismissed = false
        } else {
          // Normal renewal - clear adjusted state, reset dismissed flag for clean state
          updatePayload.auto_renew_adjusted_at = null
          updatePayload.auto_renew_adjusted_dismissed = false
        }

        await tablesDB.updateRow({
          databaseId: DATABASE_ID,
          tableId: USER_SUBSCRIPTIONS_COLLECTION_ID,
          rowId: sub.$id,
          data: updatePayload,
        })

        log(
          `[AutoRenew] Successfully renewed user ${userId} until ${newExpiresAt.toISOString()}`
        )
        results.renewed++
        results.details.push({
          userId,
          status: 'renewed',
          tier: renewedTier,
          requestedTier,
          pointsSpent: renewedCost,
          newBalance,
          newExpiresAt: newExpiresAt.toISOString(),
          adjusted: wasAdjusted,
        })
      } catch (userError) {
        error(
          `[AutoRenew] Error processing user ${userId}: ${userError.message}`
        )
        results.failed++
        results.details.push({
          userId,
          status: 'error',
          reason: userError.message,
        })
      }
    }

    log(
      `[AutoRenew] Completed. Processed: ${results.processed}, Renewed: ${results.renewed}, Failed: ${results.failed}`
    )

    return res.json({
      success: true,
      ...results,
    })
  } catch (err) {
    error(`[AutoRenew] Fatal error: ${err.message}`)
    return res.json(
      {
        success: false,
        error: err.message,
        ...results,
      },
      500
    )
  }
}

/**
 * Disable auto-renew for a subscription and mark as failed
 */
async function disableAutoRenew(
  tablesDB,
  databaseId,
  collectionId,
  rowId,
  userId
) {
  await tablesDB.updateRow({
    databaseId,
    tableId: collectionId,
    rowId,
    data: {
      auto_renew: false,
      // Set failed state
      auto_renew_failed_at: new Date().toISOString(),
      auto_renew_failed_dismissed: false,
      // Clear any previous adjusted state - failure supersedes adjustment
      // This ensures clean database state (only one alert condition at a time)
      auto_renew_adjusted_at: null,
      auto_renew_adjusted_dismissed: false, // Reset for clean state
    },
  })
}
