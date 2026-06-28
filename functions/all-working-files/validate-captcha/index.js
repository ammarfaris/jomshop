const { Client, TablesDB, Query, ID } = require('node-appwrite')

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  INTERNAL_API_KEY,
  TURNSTILE_SECRET_KEY,
  DATABASE_ID,
  RATE_LIMITS_COLLECTION_ID,
  SUSPICIOUS_ACTIVITY_COLLECTION_ID,
} = process.env

// Action-specific rate limits
const RATE_LIMITS_BY_ACTION = {
  submit_feedback: {
    perUserPerHour: 20,
    perIPPerMinute: 10,
  },
  upload_receipt: {
    perUserPerHour: 50, // More lenient for receipts
    perIPPerMinute: 20,
  },
  submit_contact_form: {
    perUserPerHour: 10, // Stricter for contact forms
    perIPPerMinute: 5,
  },
  // Default for unknown actions
  default: {
    perUserPerHour: 20,
    perIPPerMinute: 10,
  },
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(INTERNAL_API_KEY)

const tablesDB = new TablesDB(client)

/**
 * Verify Cloudflare Turnstile CAPTCHA token
 */
async function verifyTurnstile(token, remoteIP) {
  try {
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: TURNSTILE_SECRET_KEY,
          response: token,
          remoteip: remoteIP,
        }),
      }
    )

    const result = await response.json()
    return result.success === true
  } catch (error) {
    return false
  }
}

/**
 * Get rate limits for a specific action
 */
function getRateLimitsForAction(action) {
  return RATE_LIMITS_BY_ACTION[action] || RATE_LIMITS_BY_ACTION.default
}

/**
 * Check rate limits for a user
 */
async function checkUserRateLimit(userId, action) {
  try {
    const limits = getRateLimitsForAction(action)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const result = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: RATE_LIMITS_COLLECTION_ID,
      queries: [
        Query.equal('user_id', userId),
        Query.equal('action', action),
        Query.greaterThan('$createdAt', oneHourAgo),
        Query.limit(limits.perUserPerHour + 1),
      ],
    })

    return {
      withinLimit: result.total < limits.perUserPerHour,
      limit: limits.perUserPerHour,
      current: result.total,
    }
  } catch (error) {
    return { withinLimit: true, limit: 0, current: 0 }
  }
}

/**
 * Check rate limits for an IP address
 */
async function checkIPRateLimit(ipAddress, action) {
  try {
    const limits = getRateLimitsForAction(action)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()

    const result = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: RATE_LIMITS_COLLECTION_ID,
      queries: [
        Query.equal('ip_address', ipAddress),
        Query.equal('action', action),
        Query.greaterThan('$createdAt', oneMinuteAgo),
        Query.limit(limits.perIPPerMinute + 1),
      ],
    })

    return {
      withinLimit: result.total < limits.perIPPerMinute,
      limit: limits.perIPPerMinute,
      current: result.total,
    }
  } catch (error) {
    return { withinLimit: true, limit: 0, current: 0 }
  }
}

/**
 * Log rate limit activity
 */
async function logRateLimitAttempt(
  userId,
  ipAddress,
  action,
  userName,
  userEmail
) {
  try {
    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: RATE_LIMITS_COLLECTION_ID,
      rowId: ID.unique(),
      data: {
        user_id: userId,
        user_name: userName || '',
        user_email: userEmail || '',
        ip_address: ipAddress,
        action,
        timestamp: new Date().toISOString(),
      },
      permissions: [],
    })
  } catch (error) {
    // Silently fail - rate limit tracking shouldn't block user actions
  }
}

/**
 * Log suspicious activity
 */
async function logSuspiciousActivity(userId, ipAddress, reason, metadata = {}) {
  try {
    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: SUSPICIOUS_ACTIVITY_COLLECTION_ID,
      rowId: ID.unique(),
      data: {
        user_id: userId,
        user_name: metadata.user_name || '',
        user_email: metadata.user_email || '',
        ip_address: ipAddress,
        reason,
        metadata: JSON.stringify(metadata),
        timestamp: new Date().toISOString(),
      },
      permissions: [],
    })
  } catch (error) {
    // Silently fail - logging shouldn't block user actions
  }
}

function extractIpAddress(headers) {
  const xff = headers['x-forwarded-for'] || headers['X-Forwarded-For']
  if (xff && typeof xff === 'string') {
    // Take the first IP in the list
    const first = xff.split(',')[0].trim()
    if (first) return first
  }
  const realIp = headers['x-real-ip'] || headers['X-Real-IP']
  if (realIp) return realIp
  const cfConn = headers['cf-connecting-ip'] || headers['CF-Connecting-IP']
  if (cfConn) return cfConn
  return 'unknown'
}

module.exports = async ({ req, res, log, error }) => {
  try {
    // Parse request
    const {
      captcha_token,
      user_id,
      action = 'unknown',
      user_name,
      user_email,
      ip_address, // IP passed from calling function
      skip_rate_limit = false, // ⚡ NEW: Allow skipping rate limits for authenticated users
    } = JSON.parse(req.body || '{}')

    // Use IP from body if provided (function-to-function calls), otherwise extract from headers
    const ipAddress = ip_address || extractIpAddress(req.headers)

    // Validate required fields
    if (!captcha_token) {
      return res.json(
        {
          success: false,
          error: 'CAPTCHA token is required',
        },
        400
      )
    }

    if (!user_id) {
      return res.json(
        {
          success: false,
          error: 'User ID is required',
        },
        400
      )
    }

    // 1. Verify CAPTCHA
    const isCaptchaValid = await verifyTurnstile(captcha_token, ipAddress)

    if (!isCaptchaValid) {
      await logSuspiciousActivity(user_id, ipAddress, 'captcha_failed', {
        action,
        user_name,
        user_email,
      })

      return res.json(
        {
          success: false,
          error: 'CAPTCHA verification failed',
          code: 'INVALID_CAPTCHA',
        },
        403
      )
    }

    // 2. Check rate limits (skip if requested for authenticated users)
    if (!skip_rate_limit) {
      log('Checking rate limits...')

      // Check user rate limit (action-specific)
      const userLimitCheck = await checkUserRateLimit(user_id, action)

      if (!userLimitCheck.withinLimit) {
        await logSuspiciousActivity(user_id, ipAddress, 'rate_limit_exceeded', {
          action,
          limit_type: 'user_per_hour',
          current: userLimitCheck.current,
          limit: userLimitCheck.limit,
          user_name,
          user_email,
        })

        return res.json(
          {
            success: false,
            error: `Too many ${action} requests. Limit: ${userLimitCheck.limit}/hour. Try again later.`,
            code: 'RATE_LIMIT_EXCEEDED',
            details: {
              limit: userLimitCheck.limit,
              current: userLimitCheck.current,
              resetIn: '1 hour',
            },
          },
          429
        )
      }

      // Check IP rate limit (action-specific)
      const ipLimitCheck = await checkIPRateLimit(ipAddress, action)

      if (!ipLimitCheck.withinLimit) {
        await logSuspiciousActivity(
          user_id,
          ipAddress,
          'ip_rate_limit_exceeded',
          {
            action,
            limit_type: 'ip_per_minute',
            current: ipLimitCheck.current,
            limit: ipLimitCheck.limit,
            user_name,
            user_email,
          }
        )

        return res.json(
          {
            success: false,
            error: `Too many requests from this location. Limit: ${ipLimitCheck.limit}/minute. Try again later.`,
            code: 'RATE_LIMIT_EXCEEDED',
            details: {
              limit: ipLimitCheck.limit,
              current: ipLimitCheck.current,
              resetIn: '1 minute',
            },
          },
          429
        )
      }

      // Log successful rate limit check (include name/email for analytics)
      await logRateLimitAttempt(
        user_id,
        ipAddress,
        action,
        user_name,
        user_email
      )
    } else {
      log('⚡ Rate limiting skipped (authenticated user optimization)')
    }

    // All checks passed
    return res.json({
      success: true,
      message: 'Validation successful',
      action,
    })
  } catch (err) {
    error(`Validation error: ${err.message}`)
    return res.json(
      {
        success: false,
        error: 'Validation failed',
      },
      500
    )
  }
}
