/**
 * Update Auto-Renew Setting
 *
 * Allows users to toggle auto-renewal of their subscription using points.
 * When enabled, the system will automatically deduct points to renew
 * their subscription when it expires (if they have sufficient points).
 *
 * Environment Variables Required:
 * - APPWRITE_ENDPOINT
 * - APPWRITE_PROJECT_ID
 * - INTERNAL_API_KEY
 * - DATABASE_ID
 * - USER_SUBSCRIPTIONS_COLLECTION_ID
 *
 * Request Body:
 * - autoRenew: boolean (true to enable, false to disable)
 *
 * Response:
 * - success: boolean
 * - autoRenew: boolean (new value)
 */

const {
  Client,
  TablesDB,
  Query,
  ID,
  Permission,
  Role,
} = require('node-appwrite')

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

/**
 * Main handler
 */
module.exports = async ({ req, res, log, error }) => {
  try {
    // Get user ID from JWT
    const userId = req.headers['x-appwrite-user-id']

    if (!userId) {
      return res.json({ success: false, error: 'Authentication required' }, 401)
    }

    // Parse request body
    let body = {}
    if (req.body) {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    }

    const { autoRenew, clearFailed, dismissType, autoRenewNextTier } = body
    // dismissType can be: 'failed', 'adjusted', or 'all' (or undefined)
    // clearFailed is legacy - treated as dismissType: 'all'
    // autoRenew is optional when only dismissing alerts (dismissType provided)

    // autoRenew is required unless we're just dismissing alerts
    const isDismissOnly = dismissType !== undefined || clearFailed
    if (autoRenew !== undefined && typeof autoRenew !== 'boolean') {
      return res.json(
        { success: false, error: 'autoRenew must be a boolean' },
        400
      )
    }
    if (autoRenew === undefined && !isDismissOnly) {
      return res.json(
        {
          success: false,
          error: 'autoRenew is required unless dismissing alerts',
        },
        400
      )
    }

    if (
      autoRenewNextTier !== undefined &&
      autoRenewNextTier !== null &&
      autoRenewNextTier !== 'plus' &&
      autoRenewNextTier !== 'pro'
    ) {
      return res.json(
        { success: false, error: 'autoRenewNextTier must be "plus" or "pro"' },
        400
      )
    }

    if (
      dismissType !== undefined &&
      dismissType !== 'failed' &&
      dismissType !== 'adjusted' &&
      dismissType !== 'all'
    ) {
      return res.json(
        {
          success: false,
          error: 'dismissType must be "failed", "adjusted", or "all"',
        },
        400
      )
    }

    log(
      `Updating for user ${userId}${
        autoRenew !== undefined ? ` auto_renew=${autoRenew}` : ''
      }${
        clearFailed || dismissType ? ` (dismiss: ${dismissType || 'all'})` : ''
      }`
    )

    // Check if user has a subscription record
    const subRecords = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: USER_SUBSCRIPTIONS_COLLECTION_ID,
      queries: [Query.equal('user_id', userId), Query.limit(1)],
    })

    // Prepare update data - only include auto_renew if explicitly provided
    const updateData = {}
    if (autoRenew !== undefined) {
      updateData.auto_renew = autoRenew
    }

    // Update auto-renew next tier preference if provided
    if (autoRenewNextTier !== undefined) {
      updateData.auto_renew_next_tier = autoRenewNextTier
    }

    // When dismissing alerts, set dismissed flags (but preserve timestamps for auditing)
    // Determine which alerts to dismiss based on dismissType or legacy clearFailed
    const effectiveDismissType = dismissType || (clearFailed ? 'all' : null)

    // Only dismiss alerts if a dismissType was explicitly provided
    // Note: autoRenew value doesn't affect which alerts to dismiss - that's controlled by dismissType
    if (effectiveDismissType) {
      if (effectiveDismissType === 'all' || effectiveDismissType === 'failed') {
        updateData.auto_renew_failed_dismissed = true
      }
      if (
        effectiveDismissType === 'all' ||
        effectiveDismissType === 'adjusted'
      ) {
        updateData.auto_renew_adjusted_dismissed = true
      }
    }

    if (subRecords.total > 0) {
      // Update existing subscription record
      await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: USER_SUBSCRIPTIONS_COLLECTION_ID,
        rowId: subRecords.rows[0].$id,
        data: updateData,
      })
      log(`Updated auto_renew for existing subscription record`)
    } else if (isDismissOnly) {
      // No subscription record exists but user is trying to dismiss alerts
      // Create a minimal record with dismissed flags to persist the state
      // Also preserve autoRenew and autoRenewNextTier if provided
      await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: USER_SUBSCRIPTIONS_COLLECTION_ID,
        rowId: ID.unique(),
        data: {
          user_id: userId,
          tier: 'free',
          source: 'none',
          expires_at: null,
          auto_renew: autoRenew ?? false, // Preserve user's preference if provided
          auto_renew_next_tier: autoRenewNextTier ?? null, // Preserve tier preference if provided
          auto_renew_failed_at: null,
          auto_renew_failed_dismissed:
            effectiveDismissType === 'all' || effectiveDismissType === 'failed',
          auto_renew_adjusted_at: null,
          auto_renew_adjusted_dismissed:
            effectiveDismissType === 'all' ||
            effectiveDismissType === 'adjusted',
          revenuecat_customer_id: null,
          last_event_id: null,
        },
        permissions: [
          Permission.read(Role.user(userId)),
          // No write permission for user - only server can modify
        ],
      })
      log(`Created subscription record with dismissed flags for user ${userId}`)
    } else {
      // Create a new subscription record with just auto_renew preference
      // This allows free users to set the preference for when they subscribe
      await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: USER_SUBSCRIPTIONS_COLLECTION_ID,
        rowId: ID.unique(),
        data: {
          user_id: userId,
          tier: 'free',
          source: 'none',
          expires_at: null,
          auto_renew: autoRenew,
          auto_renew_failed_at: null,
          auto_renew_failed_dismissed: false,
          auto_renew_adjusted_at: null,
          auto_renew_adjusted_dismissed: false,
          ...(autoRenewNextTier !== undefined
            ? { auto_renew_next_tier: autoRenewNextTier }
            : {}),
          revenuecat_customer_id: null,
          last_event_id: null,
        },
        permissions: [
          Permission.read(Role.user(userId)),
          // No write permission for user - only server can modify
        ],
      })
      log(`Created new subscription record with auto_renew preference`)
    }

    // Build appropriate response message based on what was changed
    let message
    if (autoRenew !== undefined) {
      message = autoRenew
        ? 'Auto-renewal enabled. Your subscription will be renewed using points when it expires.'
        : 'Auto-renewal disabled.'
    } else if (effectiveDismissType) {
      message = 'Alert dismissed.'
    } else {
      message = 'Settings updated.'
    }

    return res.json({
      success: true,
      autoRenew: autoRenew ?? null,
      autoRenewNextTier: autoRenewNextTier ?? null,
      message,
    })
  } catch (err) {
    error('Error updating auto-renew: ' + err.message)
    error(err.stack)
    return res.json(
      { success: false, error: 'Failed to update auto-renew setting' },
      500
    )
  }
}
