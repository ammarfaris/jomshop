/**
 * RevenueCat Webhook Handler
 *
 * Receives webhook events from RevenueCat and updates user_subscriptions collection.
 * This is the ONLY secure way for subscription tiers to be updated.
 *
 * Environment Variables Required:
 * - APPWRITE_ENDPOINT
 * - APPWRITE_PROJECT_ID
 * - INTERNAL_API_KEY
 * - DATABASE_ID
 * - USER_SUBSCRIPTIONS_COLLECTION_ID
 * - REVENUECAT_WEBHOOK_SECRET (for signature validation)
 *
 * RevenueCat Webhook Events:
 * - INITIAL_PURCHASE: New subscription purchased
 * - RENEWAL: Subscription renewed
 * - CANCELLATION: Subscription cancelled (still active until expires_at)
 * - EXPIRATION: Subscription expired
 * - PRODUCT_CHANGE: User upgraded/downgraded
 * - UNCANCELLATION: User reactivated cancelled subscription
 * - BILLING_ISSUE: Payment failed
 * - SUBSCRIBER_ALIAS: User identity linked
 */

const { Client, TablesDB, Query, ID } = require('node-appwrite')
const crypto = require('crypto')

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  INTERNAL_API_KEY,
  DATABASE_ID,
  USER_SUBSCRIPTIONS_COLLECTION_ID,
  REVENUECAT_WEBHOOK_SECRET,
} = process.env

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(INTERNAL_API_KEY)

const tablesDB = new TablesDB(client)

/**
 * Map RevenueCat product identifiers to our tier names
 */
const PRODUCT_TO_TIER = {
  plus_monthly: 'plus',
  plus_yearly: 'plus',
  pro_monthly: 'pro',
  pro_yearly: 'pro',
}

/**
 * Map RevenueCat entitlement identifiers to our tier names
 */
const ENTITLEMENT_TO_TIER = {
  plus: 'plus',
  pro: 'pro',
}

/**
 * Validate RevenueCat webhook signature
 * RevenueCat signs webhooks with HMAC SHA256
 */
function validateWebhookSignature(payload, signature, secret) {
  if (!secret) {
    // If no secret configured, skip validation (not recommended for production)
    console.warn(
      'REVENUECAT_WEBHOOK_SECRET not configured - skipping signature validation'
    )
    return true
  }

  if (!signature) {
    return false
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

    // Compare signatures securely
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch (error) {
    console.error('Signature validation error:', error)
    return false
  }
}

/**
 * Extract the highest tier from active entitlements
 */
function extractTierFromEntitlements(entitlements) {
  if (!entitlements || Object.keys(entitlements).length === 0) {
    return 'free'
  }

  // Pro takes precedence over Plus
  if (entitlements.pro && entitlements.pro.expires_date) {
    const expiresAt = new Date(entitlements.pro.expires_date)
    if (expiresAt > new Date()) {
      return 'pro'
    }
  }

  if (entitlements.plus && entitlements.plus.expires_date) {
    const expiresAt = new Date(entitlements.plus.expires_date)
    if (expiresAt > new Date()) {
      return 'plus'
    }
  }

  return 'free'
}

/**
 * Get expiration date from entitlements
 */
function extractExpiresAt(entitlements, tier) {
  if (tier === 'free') return null

  const entitlement = entitlements?.[tier]
  if (entitlement?.expires_date) {
    return entitlement.expires_date
  }

  return null
}

/**
 * Determine subscription source (money vs points)
 */
function extractSource(entitlements, tier) {
  if (tier === 'free') return 'none'

  const entitlement = entitlements?.[tier]
  // RevenueCat marks promotional grants with store = "promotional"
  if (entitlement?.store === 'promotional') {
    return 'points'
  }

  return 'money'
}

/**
 * Get or create subscription record for a user
 */
async function getOrCreateSubscription(userId, revenuecatCustomerId) {
  try {
    // Try to find existing subscription by user_id
    const existing = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: USER_SUBSCRIPTIONS_COLLECTION_ID,
      queries: [Query.equal('user_id', userId), Query.limit(1)],
    })

    if (existing.total > 0) {
      return existing.rows[0]
    }

    // Try to find by revenuecat_customer_id
    if (revenuecatCustomerId) {
      const byRevenueCat = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: USER_SUBSCRIPTIONS_COLLECTION_ID,
        queries: [
          Query.equal('revenuecat_customer_id', revenuecatCustomerId),
          Query.limit(1),
        ],
      })

      if (byRevenueCat.total > 0) {
        return byRevenueCat.rows[0]
      }
    }

    // Create new subscription record
    const newDoc = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: USER_SUBSCRIPTIONS_COLLECTION_ID,
      rowId: userId, // Use userId as document ID for easy lookups
      data: {
        user_id: userId,
        tier: 'free',
        source: 'none',
        expires_at: null,
        revenuecat_customer_id: revenuecatCustomerId || null,
        last_event_id: null,
      },
    })

    return newDoc
  } catch (error) {
    // If document already exists with this ID, fetch it
    if (error.code === 409) {
      return await tablesDB.getRow({
        databaseId: DATABASE_ID,
        tableId: USER_SUBSCRIPTIONS_COLLECTION_ID,
        rowId: userId,
      })
    }
    throw error
  }
}

/**
 * Update subscription in database
 */
async function updateSubscription(docId, data, eventId) {
  try {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: USER_SUBSCRIPTIONS_COLLECTION_ID,
      rowId: docId,
      data: {
        ...data,
        last_event_id: eventId,
      },
    })
    return true
  } catch (error) {
    console.error('Failed to update subscription:', error)
    throw error
  }
}

/**
 * Process webhook event
 */
async function processWebhookEvent(event, log) {
  const eventType = event.type
  const eventId = event.id
  const appUserId = event.app_user_id
  const entitlements = event.subscriber_info?.entitlements || {}

  log(`Processing event: ${eventType} for user: ${appUserId}`)

  // Get app_user_id - this should be our Appwrite user ID
  // RevenueCat's original_app_user_id is what we passed during configure()
  const userId = event.original_app_user_id || appUserId

  if (!userId) {
    log('Error: No user ID found in webhook event')
    return { success: false, error: 'No user ID in event' }
  }

  // Get or create subscription record
  const subscription = await getOrCreateSubscription(userId, appUserId)

  // Check for duplicate event (idempotency)
  if (subscription.last_event_id === eventId) {
    log(`Duplicate event ${eventId} - skipping`)
    return { success: true, skipped: true }
  }

  // Determine new tier and expiry from entitlements
  const newTier = extractTierFromEntitlements(entitlements)
  const expiresAt = extractExpiresAt(entitlements, newTier)
  const source = extractSource(entitlements, newTier)

  log(`New tier: ${newTier}, expires: ${expiresAt}, source: ${source}`)

  // Handle specific event types
  switch (eventType) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
      // Active subscription events - update tier
      await updateSubscription(
        subscription.$id,
        {
          tier: newTier,
          source: source,
          expires_at: expiresAt,
          revenuecat_customer_id: appUserId,
        },
        eventId
      )
      log(`Updated subscription to tier: ${newTier}`)
      break

    case 'CANCELLATION':
      // User cancelled but subscription still active until expires_at
      // Keep the current tier, just update the event ID
      await updateSubscription(
        subscription.$id,
        {
          // Keep tier and expiry - they'll downgrade on EXPIRATION
          revenuecat_customer_id: appUserId,
        },
        eventId
      )
      log('Subscription cancelled - will expire at: ' + expiresAt)
      break

    case 'EXPIRATION':
      // Subscription expired - downgrade to free
      await updateSubscription(
        subscription.$id,
        {
          tier: 'free',
          source: 'none',
          expires_at: null,
          revenuecat_customer_id: appUserId,
        },
        eventId
      )
      log('Subscription expired - downgraded to free')
      break

    case 'BILLING_ISSUE':
      // Payment failed - log but don't change tier yet
      // RevenueCat will send EXPIRATION if grace period ends
      log('Billing issue detected - awaiting resolution')
      await updateSubscription(subscription.$id, {}, eventId)
      break

    case 'SUBSCRIBER_ALIAS':
      // User identity linked - update customer ID mapping
      await updateSubscription(
        subscription.$id,
        {
          revenuecat_customer_id: appUserId,
        },
        eventId
      )
      log('User identity linked')
      break

    default:
      log(`Unhandled event type: ${eventType}`)
      // Still mark as processed to avoid reprocessing
      await updateSubscription(subscription.$id, {}, eventId)
  }

  return { success: true, tier: newTier }
}

/**
 * Main handler
 */
module.exports = async ({ req, res, log, error }) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.json({ error: 'Method not allowed' }, 405)
  }

  try {
    // Get raw body for signature validation
    const rawBody =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    const signature = req.headers['x-revenuecat-signature']

    // Validate webhook signature
    if (
      !validateWebhookSignature(rawBody, signature, REVENUECAT_WEBHOOK_SECRET)
    ) {
      error('Invalid webhook signature')
      return res.json({ error: 'Invalid signature' }, 401)
    }

    // Parse the webhook payload
    const payload =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body

    // RevenueCat sends event in the 'event' field
    const event = payload.event

    if (!event) {
      error('No event in webhook payload')
      return res.json({ error: 'No event in payload' }, 400)
    }

    // Process the event
    const result = await processWebhookEvent(event, log)

    if (result.success) {
      log('Webhook processed successfully')
      return res.json({ success: true, ...result }, 200)
    } else {
      error('Failed to process webhook: ' + result.error)
      return res.json({ error: result.error }, 500)
    }
  } catch (err) {
    error('Webhook handler error: ' + err.message)
    return res.json({ error: 'Internal server error' }, 500)
  }
}
