// functions with 404 error in our appwrite console
// this is naming in appwrite console only, we refer to all our functions by ID
// - process-feedback-optimized => replaced with process-feedback-2-optimized
// - sanitize-text => replaced with sanitize-texts

// START FOLLOW SEQUENCE from global.fn.env
// General (2)
export const APPWRITE_PROJECT_ID = '6915515900296397d382'
//export const APPWRITE_ENDPOINT = 'https://sgp.cloud.appwrite.io/v1'
export const APPWRITE_ENDPOINT = 'https://server.jomcontest.com/v1'

// Main DB (1)
export const DATABASE_ID = '6859b128002afc56c476'

// Admin (1)
export const ADMIN_TEAM_ID = 'admin'

// Storage / Buckets (3)
export const CONTESTS_BUCKET_ID = '685d03500000f2bd58ba'
export const USERS_RECEIPTS_BUCKET_ID = '690d9d55003242e2a2b1'
export const USERS_RECEIPTS_ARCHIVE_BUCKET_ID = 'usersReceiptsArchiveBucket'

// Tables / Collections (12) - (6) = (6)
// CONTEST_TRANSLATIONS_COLLECTION_ID and CONTEST_UPVOTES_COLLECTION_ID are only used in public-contests function
export const CONTESTS_COLLECTION_ID = '685cf6300007429951cc'
export const CONTEST_FILES_COLLECTION_ID = '686739b0002603ba8e88'

export const CONTEST_HOSTS_COLLECTION_ID = 'contestHosts'
export const CONTEST_CATEGORIES_COLLECTION_ID = 'contestCategories'
export const USERS_RECEIPTS_COLLECTION_ID = 'usersReceipts'
// APP_SETTINGS_COLLECTION_ID removed - limits now based on subscription tier

// Points System Collections
export const USER_POINTS_COLLECTION_ID = 'userPoints'
export const POINTS_TRANSACTIONS_COLLECTION_ID = 'pointsTransactions'

// Subscription System Collection (server-controlled, no client write access)
export const USER_SUBSCRIPTIONS_COLLECTION_ID = 'userSubscriptions'

// Referral System Collections
export const USER_REFERRALS_COLLECTION_ID = 'userReferrals'
export const REFERRAL_SETTINGS_COLLECTION_ID = 'referralSettings'

// Public Collections (anonymous access)
export const PUBLIC_CONTESTS_COLLECTION_ID = 'publicContests'
export const PUBLIC_CONTEST_TRANSLATIONS_COLLECTION_ID =
  'publicContestTranslations'

// END FOLLOW SEQUENCE from global.fn.env

// Functions
// VALIDATE_CAPTCHA_FUNCTION_ID and SANITIZE_TEXT_FUNCTION_ID are server-side only (set as env vars in Appwrite)
export const PROCESS_FEEDBACK_FUNCTION_ID = '6908400c0030a1e117b4' // this is our process-feedback-optimized function
export const VALIDATE_RECEIPT_UPLOAD_FUNCTION_ID = '69079c76000d70f2b7bb'
export const UPDATE_RECEIPT_NOTES_FUNCTION_ID = '690dd09c000cc197e204'
export const ARCHIVE_RECEIPTS_FUNCTION_ID = '69083b5100310d3e8195'
export const GENERATE_IMG_BLURHASH_IMG_TOKEN_FN_ID = '68f2e388002d9a6d76f5'
export const PUBLIC_CONTESTS_FUNCTION_ID = 'fn_public-contests_1765067990_6624'
export const SYNC_PUBLIC_CONTESTS_FUNCTION_ID = 'fn_sync-public-contests' // Admin-only sync function

// Subscription & Points Functions
export const GET_SUBSCRIPTION_TIER_FUNCTION_ID =
  'fn_get-subscription-tier_1766476188'
export const INITIALIZE_USER_POINTS_FUNCTION_ID =
  'fn_initialize-user-points_176647620'
export const GET_USER_POINTS_FUNCTION_ID = 'fn_get-user-points_1766476231_1bc9'
export const REDEEM_POINTS_FUNCTION_ID = 'fn_redeem-points-for-subscription_1'
// Note: revenuecat-webhook and award-points are server-side only (not called from client)

// Storage / Buckets
export const CONTEST_HOSTS_BUCKET_ID = 'contestHostsBucket'

// Tables / Collections
export const CONTEST_TRANSLATIONS_COLLECTION_ID = 'contestTranslations'
export const CONTEST_UPVOTES_COLLECTION_ID = 'contestUpvotes'
export const CONTEST_SAVES_COLLECTION_ID = 'contestSaves'
