const { Client, TablesDB, Query, ID } = require('node-appwrite')

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  INTERNAL_API_KEY,
  DATABASE_ID,
  CONTESTS_COLLECTION_ID,
  CONTEST_HOSTS_COLLECTION_ID,
  CONTEST_CATEGORIES_COLLECTION_ID,
  CONTEST_FILES_COLLECTION_ID,
  CONTEST_TRANSLATIONS_COLLECTION_ID,
  CONTEST_UPVOTES_COLLECTION_ID,
  RATE_LIMITS_COLLECTION_ID,
  SUSPICIOUS_ACTIVITY_COLLECTION_ID,
} = process.env

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(INTERNAL_API_KEY)

const tablesDB = new TablesDB(client)

// Rate limits for public contest access (anonymous)
const PUBLIC_CONTESTS_RATE_LIMITS = {
  perIPPerHour: 100, // Generous for AdSense crawler and normal users
  perIPPerMinute: 10, // Reasonable for browsing
}

// Cache duration for responses (5 minutes)
const CACHE_DURATION_SECONDS = 300

// In-memory cache for public contests (reduces cold start impact on subsequent calls)
let publicContestsCache = null
let cacheTimestamp = 0
const MEMORY_CACHE_TTL_MS = 60 * 1000 // 1 minute in-memory cache

/**
 * Check if in-memory cache is valid
 */
function isCacheValid() {
  return (
    publicContestsCache !== null &&
    Date.now() - cacheTimestamp < MEMORY_CACHE_TTL_MS
  )
}

/**
 * Safely list rows with optional fallback when there are no IDs.
 */
async function listRowsSafe({ tableId, queries = [] }) {
  if (!tableId) return { rows: [], total: 0 }
  const res = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId,
    queries,
  })
  return { rows: res.rows || [], total: res.total || 0 }
}

/**
 * Extract IP address from request headers
 */
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

/**
 * Check rate limits for a client (using clientId or IP address)
 * @param {string} identifier - Either clientId (preferred) or IP address
 * @param {string} identifierType - 'client' or 'ip' to distinguish the identifier type
 */
async function checkRateLimit(identifier, identifierType = 'client') {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()

    // Use user_id field for clientId, ip_address for IP
    const identifierField =
      identifierType === 'client' ? 'user_id' : 'ip_address'

    // Check hourly limit
    const hourlyResult = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: RATE_LIMITS_COLLECTION_ID,
      queries: [
        Query.equal(identifierField, identifier),
        Query.equal('action', 'public_contests'),
        Query.greaterThan('$createdAt', oneHourAgo),
        Query.limit(PUBLIC_CONTESTS_RATE_LIMITS.perIPPerHour + 1),
      ],
    })

    // Check minute limit
    const minuteResult = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: RATE_LIMITS_COLLECTION_ID,
      queries: [
        Query.equal(identifierField, identifier),
        Query.equal('action', 'public_contests'),
        Query.greaterThan('$createdAt', oneMinuteAgo),
        Query.limit(PUBLIC_CONTESTS_RATE_LIMITS.perIPPerMinute + 1),
      ],
    })

    const withinHourlyLimit =
      hourlyResult.total < PUBLIC_CONTESTS_RATE_LIMITS.perIPPerHour
    const withinMinuteLimit =
      minuteResult.total < PUBLIC_CONTESTS_RATE_LIMITS.perIPPerMinute

    return {
      withinLimit: withinHourlyLimit && withinMinuteLimit,
      hourlyLimit: PUBLIC_CONTESTS_RATE_LIMITS.perIPPerHour,
      hourlyCurrent: hourlyResult.total,
      minuteLimit: PUBLIC_CONTESTS_RATE_LIMITS.perIPPerMinute,
      minuteCurrent: minuteResult.total,
    }
  } catch (error) {
    // On rate limit check failure, allow the request (fail open)
    return {
      withinLimit: true,
      hourlyLimit: PUBLIC_CONTESTS_RATE_LIMITS.perIPPerHour,
      hourlyCurrent: 0,
      minuteLimit: PUBLIC_CONTESTS_RATE_LIMITS.perIPPerMinute,
      minuteCurrent: 0,
    }
  }
}

/**
 * Log rate limit activity for public contest access
 * @param {string} clientId - The client identifier (generated on frontend)
 * @param {string} ipAddress - IP address (may be 'unknown' from Appwrite functions)
 * @param {string} userAgent - User agent string
 */
async function logPublicContestAccess(clientId, ipAddress, userAgent = '') {
  try {
    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: RATE_LIMITS_COLLECTION_ID,
      rowId: ID.unique(),
      data: {
        user_id: clientId || 'anonymous', // Use clientId for tracking
        ip_address: ipAddress,
        action: 'public_contests',
        user_name: userAgent.substring(0, 200), // Store user agent for analytics
        user_email: '',
        timestamp: new Date().toISOString(),
      },
      permissions: [],
    })
  } catch (error) {
    // Silently fail - logging shouldn't block user actions
  }
}

/**
 * Log suspicious activity for public contest access
 */
async function logSuspiciousActivity(ipAddress, reason, metadata = {}) {
  try {
    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: SUSPICIOUS_ACTIVITY_COLLECTION_ID,
      rowId: ID.unique(),
      data: {
        user_id: 'anonymous',
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

/**
 * OPTIMIZED: Get upvote counts per contest using a SINGLE batch query.
 * This replaces N queries with 1 query, significantly reducing latency.
 */
async function getUpvoteCountsBatched(contestIds = [], log) {
  if (!contestIds.length) {
    log?.('getUpvoteCountsBatched: No contest IDs provided')
    return {}
  }
  if (!CONTEST_UPVOTES_COLLECTION_ID) {
    log?.('getUpvoteCountsBatched: CONTEST_UPVOTES_COLLECTION_ID not set')
    return {}
  }

  log?.(
    `getUpvoteCountsBatched: Fetching upvotes for ${contestIds.length} contests in ONE query`,
  )

  // Initialize counts to 0 for all contests
  const counts = {}
  contestIds.forEach((id) => {
    counts[id] = 0
  })

  try {
    // SINGLE batch query - fetch all upvotes for all contests at once
    const { rows: allUpvotes } = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: CONTEST_UPVOTES_COLLECTION_ID,
      queries: [
        Query.equal('contest_id', contestIds),
        Query.limit(5000), // Generous limit for all upvotes across contests
      ],
    })

    // Count upvotes per contest client-side (very fast)
    allUpvotes.forEach((upvote) => {
      if (upvote.contest_id && counts.hasOwnProperty(upvote.contest_id)) {
        counts[upvote.contest_id]++
      }
    })

    log?.(
      `getUpvoteCountsBatched: Fetched ${allUpvotes.length} total upvotes in 1 query`,
    )
  } catch (err) {
    log?.(`getUpvoteCountsBatched: Error: ${err.message}`)
    // Return all zeros on error
  }

  return counts
}

module.exports = async ({ req, res, log, error }) => {
  const startTime = Date.now()

  try {
    // Parse request body first to get clientId
    const body = JSON.parse(req.body || '{}')
    const clientId = body.clientId || null
    const ipAddress = extractIpAddress(req.headers)
    const userAgent = req.headers['user-agent'] || ''
    const limit = Math.min(Math.max(parseInt(body.limit, 10) || 5, 1), 20)
    const slug = body.slug

    // Cache headers for responses
    const cacheHeaders = {
      'Cache-Control': `public, max-age=${CACHE_DURATION_SECONDS}`,
      'CDN-Cache-Control': `max-age=${CACHE_DURATION_SECONDS}`,
    }

    // Check in-memory cache first (fastest path - no cold start penalty on repeat calls)
    // Only use cache for default requests (no slug filter, standard limit)
    if (!slug && limit <= 10 && isCacheValid()) {
      log?.(`Returning cached response (${Date.now() - startTime}ms)`)
      return res.json(
        {
          ...publicContestsCache,
          _meta: { cached: true, duration_ms: Date.now() - startTime },
        },
        200,
        cacheHeaders,
      )
    }

    // Determine which identifier to use for rate limiting
    // Prefer clientId (reliable) over IP (often 'unknown' in Appwrite functions)
    const rateLimitIdentifier = clientId || ipAddress
    const identifierType = clientId ? 'client' : 'ip'

    // Check rate limits using the best available identifier
    const rateLimitCheck = await checkRateLimit(
      rateLimitIdentifier,
      identifierType,
    )

    if (!rateLimitCheck.withinLimit) {
      // Log suspicious activity
      await logSuspiciousActivity(ipAddress, 'rate_limit_exceeded', {
        clientId,
        identifierType,
        hourlyLimit: rateLimitCheck.hourlyLimit,
        hourlyCurrent: rateLimitCheck.hourlyCurrent,
        minuteLimit: rateLimitCheck.minuteLimit,
        minuteCurrent: rateLimitCheck.minuteCurrent,
        userAgent,
      })

      return res.json(
        {
          error: 'Too many requests. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          details: {
            hourlyLimit: rateLimitCheck.hourlyLimit,
            hourlyCurrent: rateLimitCheck.hourlyCurrent,
            minuteLimit: rateLimitCheck.minuteLimit,
            minuteCurrent: rateLimitCheck.minuteCurrent,
            resetIn: 'Rate limits reset every hour/minute',
          },
        },
        429,
      )
    }

    // Log successful access (for analytics and rate limiting) - fire and forget
    logPublicContestAccess(clientId || 'anonymous', ipAddress, userAgent)

    // Filter by visibility='any' for public contests (visible to non-logged-in users)
    const contestQueries = [
      Query.equal('visibility', 'any'),
      Query.limit(limit),
      Query.orderDesc('$createdAt'), // Prefer newest first for public showcase
    ]

    if (slug) {
      contestQueries.push(Query.equal('slug', slug))
    }

    const { rows: contests } = await listRowsSafe({
      tableId: CONTESTS_COLLECTION_ID,
      queries: contestQueries,
    })

    if (!contests.length) {
      const emptyResponse = {
        contests: [],
        hosts: [],
        categories: [],
        files: [],
        translations: [],
        upvoteCounts: {},
        _meta: { duration_ms: Date.now() - startTime },
      }
      return res.json(emptyResponse, 200, cacheHeaders)
    }

    // Collect referenced IDs
    const contestIds = contests.map((c) => c.$id)
    const hostIds = Array.from(
      new Set(
        contests.flatMap((c) => (Array.isArray(c.host_ids) ? c.host_ids : [])),
      ),
    )
    const categoryIds = Array.from(
      new Set(
        contests.flatMap((c) =>
          Array.isArray(c.category_ids) ? c.category_ids : [],
        ),
      ),
    )

    // Execute ALL queries in parallel (5 parallel queries instead of 5 + N)
    const [hostsRes, categoriesRes, filesRes, translationsRes, upvoteCounts] =
      await Promise.all([
        listRowsSafe({
          tableId: CONTEST_HOSTS_COLLECTION_ID,
          queries: hostIds.length
            ? [Query.equal('$id', hostIds), Query.limit(100)]
            : [],
        }),
        listRowsSafe({
          tableId: CONTEST_CATEGORIES_COLLECTION_ID,
          queries: categoryIds.length
            ? [Query.equal('$id', categoryIds), Query.limit(200)]
            : [],
        }),
        listRowsSafe({
          tableId: CONTEST_FILES_COLLECTION_ID,
          queries: contestIds.length
            ? [Query.equal('contest_id', contestIds), Query.limit(200)]
            : [],
        }),
        listRowsSafe({
          tableId: CONTEST_TRANSLATIONS_COLLECTION_ID,
          queries: contestIds.length
            ? [Query.equal('contest_id', contestIds), Query.limit(200)]
            : [],
        }),
        // OPTIMIZED: Single batch query instead of N queries
        getUpvoteCountsBatched(contestIds, log),
      ])

    const responseData = {
      contests,
      hosts: hostsRes.rows,
      categories: categoriesRes.rows,
      files: filesRes.rows,
      translations: translationsRes.rows,
      upvoteCounts,
    }

    // Update in-memory cache for default requests
    if (!slug && limit <= 10) {
      publicContestsCache = responseData
      cacheTimestamp = Date.now()
      log?.(`Updated in-memory cache`)
    }

    log?.(`Response generated in ${Date.now() - startTime}ms`)

    return res.json(
      {
        ...responseData,
        _meta: { cached: false, duration_ms: Date.now() - startTime },
      },
      200,
      cacheHeaders,
    )
  } catch (err) {
    error(`public-contests failed: ${err.message}`)
    return res.json(
      {
        error: 'Failed to load public contests',
        details: err.message,
        _meta: { duration_ms: Date.now() - startTime },
      },
      500,
    )
  }
}
