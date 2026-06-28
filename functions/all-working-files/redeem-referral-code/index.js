/**
 * Redeem Referral Code Function
 *
 * PURPOSE:
 * - Allows users to enter a friend's referral code after signing up
 * - Creates a "pending" referral record linking referrer and referee
 * - Both referrer and referee get 200 points when referee uploads first receipt
 *
 * SECURITY:
 * - Prevents self-referral
 * - Ensures user can only be referred once (one referrer per user)
 * - Validates the referral code corresponds to a real user
 * - Uses internal API key for database operations
 *
 * USAGE:
 * POST /functions/redeem-referral-code
 * { "code": "<full-user-id>" }
 *
 * RESPONSE:
 * {
 *   "success": true,
 *   "message": "Referral code redeemed successfully",
 *   "referrerId": "..."
 * }
 */

import {
  Client,
  TablesDB,
  Users,
  Query,
  ID,
  Permission,
  Role,
} from 'node-appwrite'

export default async ({ req, res, log, error }) => {
  // Environment variables
  const {
    APPWRITE_ENDPOINT,
    APPWRITE_PROJECT_ID,
    INTERNAL_API_KEY,
    DATABASE_ID,
    USER_REFERRALS_COLLECTION_ID,
  } = process.env

  // Validate environment
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !INTERNAL_API_KEY) {
    error('Missing required environment variables')
    return res.json(
      { success: false, error: 'Server configuration error' },
      500
    )
  }

  if (!DATABASE_ID || !USER_REFERRALS_COLLECTION_ID) {
    error('Missing database configuration')
    return res.json(
      { success: false, error: 'Database configuration error' },
      500
    )
  }

  // Get the authenticated user's ID from the request headers
  const refereeUserId = req.headers['x-appwrite-user-id']
  if (!refereeUserId) {
    return res.json({ success: false, error: 'Authentication required' }, 401)
  }

  // Parse request body
  let code
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    code = body.code?.trim()
  } catch (e) {
    return res.json({ success: false, error: 'Invalid request body' }, 400)
  }

  // Referral code is now the full user ID (20 chars typically)
  if (!code || code.length < 15) {
    return res.json(
      { success: false, error: 'Invalid referral code format' },
      400
    )
  }

  log(`User ${refereeUserId} attempting to redeem referral code: ${code}`)

  // Initialize Appwrite client with internal API key
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(INTERNAL_API_KEY)

  const tablesDB = new TablesDB(client)
  const users = new Users(client)

  try {
    // Step 1: Check if user has already been referred
    const existingReferrals = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: USER_REFERRALS_COLLECTION_ID,
      queries: [Query.equal('referee_user_id', refereeUserId), Query.limit(1)],
    })

    if (existingReferrals.total > 0) {
      log(`User ${refereeUserId} already has a referral record`)
      return res.json(
        {
          success: false,
          error: 'You have already used a referral code',
        },
        400
      )
    }

    // Step 2: Verify the referrer exists (code is the full user ID)
    let referrerUserId = null
    let referrerEmail = null
    let referrerName = null

    try {
      const referrerUser = await users.get(code)
      if (referrerUser) {
        referrerUserId = referrerUser.$id
        referrerEmail = referrerUser.email
        referrerName = referrerUser.name
      }
    } catch (e) {
      // User not found
      log(`No user found with ID: ${code}`)
    }

    if (!referrerUserId) {
      log(`No user found with referral code: ${code}`)
      return res.json(
        {
          success: false,
          error: 'Invalid referral code. Please check and try again.',
        },
        404
      )
    }

    // Step 3: Prevent self-referral
    if (referrerUserId === refereeUserId) {
      log(`User ${refereeUserId} tried to use their own referral code`)
      return res.json(
        {
          success: false,
          error: "You can't use your own referral code",
        },
        400
      )
    }

    log(`Found referrer: ${referrerUserId} for code: ${code}`)

    // Step 3.5: Fetch referee user details
    let refereeEmail = null
    let refereeName = null

    try {
      const refereeUser = await users.get(refereeUserId)
      if (refereeUser) {
        refereeEmail = refereeUser.email
        refereeName = refereeUser.name
      }
    } catch (e) {
      log(`Could not fetch referee user details: ${e.message}`)
      // Continue anyway - these fields are optional
    }

    // Step 4: Create the pending referral record with user details
    const referralDoc = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: USER_REFERRALS_COLLECTION_ID,
      rowId: ID.unique(),
      data: {
        referrer_user_id: referrerUserId,
        referee_user_id: refereeUserId,
        referral_code: code,
        status: 'pending',
        referrer_email: referrerEmail,
        referrer_fullname: referrerName,
        referee_email: refereeEmail,
        referee_fullname: refereeName,
      },
      permissions: [
        Permission.read(Role.user(referrerUserId)),
        Permission.read(Role.user(refereeUserId)),
      ],
    })

    log(`Created pending referral: ${referralDoc.$id}`)

    return res.json({
      success: true,
      message:
        'Referral code redeemed successfully! You and your friend will each get 200 points after you upload your first receipt.',
      referralId: referralDoc.$id,
    })
  } catch (err) {
    error(`Failed to redeem referral code: ${err.message}`)
    error(err.stack)

    // Check for duplicate key error (race condition)
    if (err.code === 409) {
      return res.json(
        {
          success: false,
          error: 'You have already used a referral code',
        },
        400
      )
    }

    return res.json(
      {
        success: false,
        error: 'Failed to redeem referral code. Please try again.',
      },
      500
    )
  }
}
