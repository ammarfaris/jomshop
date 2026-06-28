const {
  Client,
  TablesDB,
  Functions,
  Users,
  Permission,
  Role,
  ID,
} = require('node-appwrite')

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  INTERNAL_API_KEY,
  DATABASE_ID,
  USERS_FEEDBACK_COLLECTION_ID,
  VALIDATE_CAPTCHA_FUNCTION_ID,
  SANITIZE_TEXT_FUNCTION_ID,
} = process.env

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(INTERNAL_API_KEY)

const tablesDB = new TablesDB(client)
const functions = new Functions(client)
const users = new Users(client)

/**
 * Log suspicious activity
 */
async function logSuspiciousActivity(userId, ipAddress, reason, metadata = {}) {
  try {
    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: process.env.SUSPICIOUS_ACTIVITY_COLLECTION_ID || 'suspiciousActivity',
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

module.exports = async ({ req, res, log, error }) => {
  try {
    // Parse request
    const {
      user_id,
      message,
      page_url = '',
      captcha_token,
    } = JSON.parse(req.body || '{}')

    // Extract IP address for rate limiting - check multiple headers
    function extractIp(headers) {
      const xff = headers['x-forwarded-for'] || headers['X-Forwarded-For']
      if (xff && typeof xff === 'string') {
        const first = xff.split(',')[0].trim()
        if (first) return first
      }
      const realIp = headers['x-real-ip'] || headers['X-Real-IP']
      if (realIp) return realIp
      const cfConn = headers['cf-connecting-ip'] || headers['CF-Connecting-IP']
      if (cfConn) return cfConn
      return 'unknown'
    }
    const ipAddress = extractIp(req.headers || {})

    // Validate required fields
    if (!user_id || !message || !captcha_token) {
      return res.json(
        {
          success: false,
          error:
            'Missing required fields: user_id, message, and captcha_token are required',
        },
        400
      )
    }

    // Fetch user data from Appwrite (server-side, secure)
    log('Fetching user data...')
    let user_name = ''
    let user_email = ''
    try {
      const user = await users.get(user_id)

      // Log the full user object to debug what fields are available
      log(
        `Full user object: ${JSON.stringify({
          $id: user.$id,
          name: user.name,
          email: user.email,
          hasName: !!user.name,
          hasEmail: !!user.email,
        })}`
      )

      // Get name and email, with fallback to empty string
      user_name = user.name || ''
      user_email = user.email || ''

      // Warn if fields are missing
      if (!user_name) {
        log(`⚠️ WARNING: User ${user_id} has no name field`)
      }
      if (!user_email) {
        log(`⚠️ WARNING: User ${user_id} has no email field`)
      }

      log(`User data fetched: ${user_name} (${user_email})`)
    } catch (err) {
      error(
        `❌ CRITICAL: Failed to fetch user data for ${user_id}: ${err.message}`
      )
      // Don't fail the entire function, but log extensively
      log(`Error stack: ${err.stack}`)
      // Continue with empty strings - feedback will still be saved
    }

    // Step 1: Validate CAPTCHA and check rate limits
    log('Validating CAPTCHA and checking rate limits...')
    const captchaValidation = await functions.createExecution(
      VALIDATE_CAPTCHA_FUNCTION_ID,
      JSON.stringify({
        captcha_token,
        user_id,
        user_name,
        user_email,
        ip_address: ipAddress, // Pass IP in body since headers don't work in function-to-function calls
        action: 'submit_feedback',
      }),
      false // synchronous
    )

    const captchaResult = JSON.parse(captchaValidation.responseBody || '{}')

    if (!captchaResult.success) {
      log(`CAPTCHA validation failed: ${captchaResult.error}`)
      return res.json(
        {
          success: false,
          error: captchaResult.error,
          code: captchaResult.code,
        },
        captchaValidation.responseStatusCode || 403
      )
    }

    log('CAPTCHA and rate limit checks passed')

    // Step 2: Sanitize message text (user input only)
    log('Sanitizing message text...')
    const sanitizeResult = await functions.createExecution(
      SANITIZE_TEXT_FUNCTION_ID,
      JSON.stringify({ text: message, max_length: 5000 }),
      false,
      '/',
      'POST'
    )

    const sanitizeData = JSON.parse(sanitizeResult.responseBody || '{}')

    if (!sanitizeData.success) {
      log(`Message sanitization failed: ${sanitizeData.error}`)
      // Log suspicious activity for sanitization failure
      await logSuspiciousActivity(user_id, ipAddress, 'sanitization_failed', {
        action: 'submit_feedback',
        error: sanitizeData.error,
        original_message_length: message.length,
        user_name,
        user_email,
      })
      return res.json(
        {
          success: false,
          error: sanitizeData.error,
        },
        400
      )
    }

    const sanitizedMessage = sanitizeData.sanitized

    if (!sanitizedMessage) {
      // Log suspicious activity for empty content after sanitization
      await logSuspiciousActivity(
        user_id,
        ipAddress,
        'sanitization_empty_result',
        {
          action: 'submit_feedback',
          original_message_length: message.length,
          user_name,
          user_email,
        }
      )
      return res.json(
        {
          success: false,
          error: 'Invalid message content after sanitization',
        },
        400
      )
    }

    // Check if dangerous content (HTML/script tags) was detected and removed
    if (sanitizeData.hadDangerousContent) {
      log('⚠️ Dangerous content detected and removed from message')
      // Log suspicious activity for XSS attempt (but still allow the submission)
      await logSuspiciousActivity(user_id, ipAddress, 'xss_attempt_detected', {
        action: 'submit_feedback',
        original_message: message.substring(0, 200), // Log first 200 chars for analysis
        sanitized_message: sanitizedMessage.substring(0, 200),
        user_name,
        user_email,
      })
    }

    log(
      `Message sanitized successfully (${sanitizeData.sanitized_length} chars)`
    )

    // User name and email from Appwrite are trusted, no sanitization needed
    const sanitizedUserName = user_name
    const sanitizedUserEmail = user_email

    // Step 3: Create feedback document (using TablesDB for future transaction support)
    log('Creating feedback document...')
    const document = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: USERS_FEEDBACK_COLLECTION_ID,
      rowId: ID.unique(),
      data: {
        user_id,
        user_name: sanitizedUserName,
        user_email: sanitizedUserEmail,
        message: sanitizedMessage,
        page_url,
      },
      permissions: [Permission.read(Role.user(user_id))], // Only the user can read their own feedback
    })

    log(`Feedback document created successfully: ${document.$id}`)

    // Return success response
    return res.json({
      success: true,
      document_id: document.$id,
      message: 'Feedback submitted successfully',
    })
  } catch (err) {
    error(`Error processing feedback: ${err.message}`)
    return res.json(
      {
        success: false,
        error: 'Failed to process feedback submission',
      },
      500
    )
  }
}
