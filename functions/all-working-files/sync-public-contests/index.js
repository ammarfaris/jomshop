/**
 * sync-public-contests
 *
 * This function syncs public contests to a denormalized collection for fast
 * anonymous user access. Run this:
 * 1. Via cron every 5-15 minutes
 * 2. When admin updates a contest's visibility
 * 3. Manually from admin panel
 *
 * The publicContests collection has read("any") permission, allowing anonymous access.
 * Upvote counts are pre-aggregated to avoid N+1 queries.
 */

const { Client, Databases, Query, ID } = require('node-appwrite')

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  INTERNAL_API_KEY,
  DATABASE_ID,
  CONTESTS_COLLECTION_ID,
  CONTEST_HOSTS_COLLECTION_ID,
  CONTEST_CATEGORIES_COLLECTION_ID,
  CONTEST_UPVOTES_COLLECTION_ID,
  CONTEST_TRANSLATIONS_COLLECTION_ID,
  PUBLIC_CONTESTS_COLLECTION_ID,
  PUBLIC_CONTEST_TRANSLATIONS_COLLECTION_ID,
} = process.env

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(INTERNAL_API_KEY)

const databases = new Databases(client)

/**
 * Safely list documents with error handling
 */
async function listDocumentsSafe(collectionId, queries = []) {
  if (!collectionId) return { documents: [], total: 0 }
  try {
    const res = await databases.listDocuments(
      DATABASE_ID,
      collectionId,
      queries,
    )
    return { documents: res.documents || [], total: res.total || 0 }
  } catch (err) {
    return { documents: [], total: 0 }
  }
}

/**
 * Fetch all upvote counts in a single batch query
 */
async function fetchUpvoteCounts(contestIds, log) {
  if (!contestIds.length || !CONTEST_UPVOTES_COLLECTION_ID) return {}

  const counts = {}
  contestIds.forEach((id) => {
    counts[id] = 0
  })

  try {
    const { documents: allUpvotes } = await listDocumentsSafe(
      CONTEST_UPVOTES_COLLECTION_ID,
      [Query.equal('contest_id', contestIds), Query.limit(10000)],
    )

    allUpvotes.forEach((upvote) => {
      if (upvote.contest_id && counts.hasOwnProperty(upvote.contest_id)) {
        counts[upvote.contest_id]++
      }
    })

    log?.(`Fetched ${allUpvotes.length} total upvotes`)
  } catch (err) {
    log?.(`Error fetching upvotes: ${err.message}`)
  }

  return counts
}

/**
 * Fetch hosts by IDs
 */
async function fetchHosts(hostIds, log) {
  if (!hostIds.length) return []

  try {
    const { documents } = await listDocumentsSafe(CONTEST_HOSTS_COLLECTION_ID, [
      Query.equal('$id', hostIds),
      Query.limit(100),
    ])
    return documents
  } catch (err) {
    log?.(`Error fetching hosts: ${err.message}`)
    return []
  }
}

/**
 * Fetch categories by IDs
 */
async function fetchCategories(categoryIds, log) {
  if (!categoryIds.length) return []

  try {
    const { documents } = await listDocumentsSafe(
      CONTEST_CATEGORIES_COLLECTION_ID,
      [Query.equal('$id', categoryIds), Query.limit(200)],
    )
    return documents
  } catch (err) {
    log?.(`Error fetching categories: ${err.message}`)
    return []
  }
}

/**
 * Build a denormalized public contest document
 * Only includes fields that exist in the publicContests collection
 */
function buildPublicContest(contest, hostsById, categoriesById, upvoteCounts) {
  // Embed host data
  const contestHosts = (contest.host_ids || [])
    .map((id) => hostsById.get(id))
    .filter(Boolean)
    .map((h) => ({
      $id: h.$id,
      name: h.name,
      slug: h.slug,
      img_id: h.img_id,
      img_token_secret: h.img_token_secret || null,
      img_blurhash: h.img_blurhash || null,
    }))

  // Embed category data (preserve order)
  const contestCategories = (contest.category_ids || [])
    .map((id) => categoriesById.get(id))
    .filter(Boolean)
    .map((c) => ({
      $id: c.$id,
      name_en: c.name_en,
      name_ms: c.name_ms,
      slug: c.slug,
      priority_order: c.priority_order || 0,
      type: c.type || 'prize',
    }))

  return {
    // Core data
    source_contest_id: contest.$id,
    title: contest.title,
    title_ms: contest.title_ms || null,
    summary: contest.summary,
    summary_ms: contest.summary_ms || null,
    slug: contest.slug,
    start_date: contest.start_date,
    end_date: contest.end_date,
    main_img_id: contest.main_img_id || null,
    main_img_token_secret: contest.main_img_token_secret || null,
    main_img_blurhash: contest.main_img_blurhash || null,
    total_prizes_value_rm: contest.total_prizes_value_rm || 0,

    // Denormalized data (JSON strings)
    upvote_count: upvoteCounts[contest.$id] || 0,
    hosts_json: JSON.stringify(contestHosts),
    categories_json: JSON.stringify(contestCategories),

    // Social/affiliate links
    link_media_instagram: contest.link_media_instagram || null,
    link_media_facebook: contest.link_media_facebook || null,
    link_media_tiktok: contest.link_media_tiktok || null,
    link_media_x: contest.link_media_x || null,
    link_media_youtube: contest.link_media_youtube || null,
    link_media_website: contest.link_media_website || null,
    link_media_linkedin: contest.link_media_linkedin || null,

    // Metadata
    synced_at: new Date().toISOString(),
  }
}

/**
 * Sync public contests to the denormalized collection
 */
async function syncToPublicCollection(publicContests, log) {
  if (!PUBLIC_CONTESTS_COLLECTION_ID) {
    throw new Error(
      'PUBLIC_CONTESTS_COLLECTION_ID environment variable not set',
    )
  }

  // Get existing public contests
  const { documents: existing } = await listDocumentsSafe(
    PUBLIC_CONTESTS_COLLECTION_ID,
    [Query.limit(200)],
  )

  const existingBySourceId = new Map(
    existing.map((e) => [e.source_contest_id, e]),
  )
  const newSourceIds = new Set(publicContests.map((p) => p.source_contest_id))

  let deleted = 0
  let updated = 0
  let created = 0

  // Delete contests no longer public
  const toDelete = existing.filter(
    (e) => !newSourceIds.has(e.source_contest_id),
  )
  for (const doc of toDelete) {
    try {
      await databases.deleteDocument(
        DATABASE_ID,
        PUBLIC_CONTESTS_COLLECTION_ID,
        doc.$id,
      )
      deleted++
      log?.(`Deleted ${doc.source_contest_id} from public collection`)
    } catch (err) {
      log?.(`Failed to delete ${doc.$id}: ${err.message}`)
    }
  }

  // Upsert contests
  for (const contest of publicContests) {
    const existingDoc = existingBySourceId.get(contest.source_contest_id)

    try {
      if (existingDoc) {
        // Update existing document
        await databases.updateDocument(
          DATABASE_ID,
          PUBLIC_CONTESTS_COLLECTION_ID,
          existingDoc.$id,
          contest,
        )
        updated++
      } else {
        // Create new document
        await databases.createDocument(
          DATABASE_ID,
          PUBLIC_CONTESTS_COLLECTION_ID,
          ID.unique(),
          contest,
          [], // Permissions - collection-level read("any") applies
        )
        created++
      }
    } catch (err) {
      log?.(`Failed to upsert ${contest.source_contest_id}: ${err.message}`)
    }
  }

  return { deleted, updated, created }
}

/**
 * Fetch translations for contests
 */
async function fetchTranslations(contestIds, log) {
  if (!contestIds.length || !CONTEST_TRANSLATIONS_COLLECTION_ID) return []

  try {
    const { documents } = await listDocumentsSafe(
      CONTEST_TRANSLATIONS_COLLECTION_ID,
      [
        Query.equal('contest_id', contestIds),
        Query.limit(200), // 100 contests * 2 locales
      ],
    )
    log?.(`Fetched ${documents.length} translations`)
    return documents
  } catch (err) {
    log?.(`Error fetching translations: ${err.message}`)
    return []
  }
}

/**
 * Build a public translation document
 * Only syncs fields that exist in publicContestTranslations collection
 */
function buildPublicTranslation(translation) {
  return {
    source_contest_id: translation.contest_id,
    locale: translation.locale,
    prizes: translation.prizes,
    eligible_products_and_purchases:
      translation.eligible_products_and_purchases || null,
    eligible_participants: translation.eligible_participants || null,
    eligible_participants_exclusion:
      translation.eligible_participants_exclusion || null,
    eligible_stores: translation.eligible_stores || null,
    entry_method_and_submission:
      translation.entry_method_and_submission || null,
    synced_at: new Date().toISOString(),
  }
}

/**
 * Sync translations to the public translations collection
 */
async function syncToPublicTranslationsCollection(
  publicTranslations,
  validContestIds,
  log,
) {
  if (!PUBLIC_CONTEST_TRANSLATIONS_COLLECTION_ID) {
    log?.(
      'PUBLIC_CONTEST_TRANSLATIONS_COLLECTION_ID not configured, skipping translations sync',
    )
    return { deleted: 0, updated: 0, created: 0 }
  }

  // Get existing public translations
  const { documents: existing } = await listDocumentsSafe(
    PUBLIC_CONTEST_TRANSLATIONS_COLLECTION_ID,
    [Query.limit(500)],
  )

  // Create key: source_contest_id + locale
  const makeKey = (t) => `${t.source_contest_id}:${t.locale}`
  const existingByKey = new Map(existing.map((e) => [makeKey(e), e]))
  const newKeys = new Set(publicTranslations.map((p) => makeKey(p)))
  const validContestIdSet = new Set(validContestIds)

  let deleted = 0
  let updated = 0
  let created = 0

  // Delete translations for contests no longer public
  const toDelete = existing.filter(
    (e) =>
      !validContestIdSet.has(e.source_contest_id) || !newKeys.has(makeKey(e)),
  )
  for (const doc of toDelete) {
    try {
      await databases.deleteDocument(
        DATABASE_ID,
        PUBLIC_CONTEST_TRANSLATIONS_COLLECTION_ID,
        doc.$id,
      )
      deleted++
    } catch (err) {
      log?.(`Failed to delete translation ${doc.$id}: ${err.message}`)
    }
  }

  // Upsert translations
  for (const translation of publicTranslations) {
    const key = makeKey(translation)
    const existingDoc = existingByKey.get(key)

    try {
      if (existingDoc) {
        await databases.updateDocument(
          DATABASE_ID,
          PUBLIC_CONTEST_TRANSLATIONS_COLLECTION_ID,
          existingDoc.$id,
          translation,
        )
        updated++
      } else {
        await databases.createDocument(
          DATABASE_ID,
          PUBLIC_CONTEST_TRANSLATIONS_COLLECTION_ID,
          ID.unique(),
          translation,
          [],
        )
        created++
      }
    } catch (err) {
      log?.(`Failed to upsert translation ${key}: ${err.message}`)
    }
  }

  return { deleted, updated, created }
}

module.exports = async ({ req, res, log, error }) => {
  const startTime = Date.now()

  try {
    log?.('Starting public contests sync...')

    // Check if collection ID is configured
    if (!PUBLIC_CONTESTS_COLLECTION_ID) {
      return res.json(
        {
          error: 'PUBLIC_CONTESTS_COLLECTION_ID not configured',
          message: 'Please set the environment variable',
        },
        400,
      )
    }

    // 1. Fetch all public contests
    const { documents: contests } = await listDocumentsSafe(
      CONTESTS_COLLECTION_ID,
      [
        Query.equal('visibility', 'any'),
        Query.orderDesc('$createdAt'),
        Query.limit(100),
      ],
    )

    log?.(`Found ${contests.length} public contests`)

    if (contests.length === 0) {
      // Clear public collection if no public contests
      const { documents: existing } = await listDocumentsSafe(
        PUBLIC_CONTESTS_COLLECTION_ID,
        [Query.limit(200)],
      )

      for (const doc of existing) {
        await databases.deleteDocument(
          DATABASE_ID,
          PUBLIC_CONTESTS_COLLECTION_ID,
          doc.$id,
        )
      }

      return res.json({
        success: true,
        synced: 0,
        deleted: existing.length,
        duration_ms: Date.now() - startTime,
      })
    }

    // 2. Gather all IDs for batch fetching
    const contestIds = contests.map((c) => c.$id)
    const hostIds = [...new Set(contests.flatMap((c) => c.host_ids || []))]
    const categoryIds = [
      ...new Set(contests.flatMap((c) => c.category_ids || [])),
    ]

    // 3. Batch fetch all related data in parallel
    const [hosts, categories, upvoteCounts, translations] = await Promise.all([
      fetchHosts(hostIds, log),
      fetchCategories(categoryIds, log),
      fetchUpvoteCounts(contestIds, log),
      fetchTranslations(contestIds, log),
    ])

    // 4. Create lookup maps
    const hostsById = new Map(hosts.map((h) => [h.$id, h]))
    const categoriesById = new Map(categories.map((c) => [c.$id, c]))

    // 5. Build denormalized documents
    const publicContests = contests.map((contest) =>
      buildPublicContest(contest, hostsById, categoriesById, upvoteCounts),
    )

    // 6. Sync to public collection
    const { deleted, updated, created } = await syncToPublicCollection(
      publicContests,
      log,
    )

    // 7. Build and sync translations
    const publicTranslations = translations.map((t) =>
      buildPublicTranslation(t),
    )
    const translationsResult = await syncToPublicTranslationsCollection(
      publicTranslations,
      contestIds,
      log,
    )

    const duration = Date.now() - startTime
    log?.(
      `Sync completed in ${duration}ms. ` +
        `Contests: ${created} created, ${updated} updated, ${deleted} deleted. ` +
        `Translations: ${translationsResult.created} created, ${translationsResult.updated} updated, ${translationsResult.deleted} deleted.`,
    )

    return res.json({
      success: true,
      contests: {
        synced: publicContests.length,
        created,
        updated,
        deleted,
      },
      translations: {
        synced: publicTranslations.length,
        created: translationsResult.created,
        updated: translationsResult.updated,
        deleted: translationsResult.deleted,
      },
      duration_ms: duration,
    })
  } catch (err) {
    error?.(`Sync failed: ${err.message}`)
    return res.json(
      {
        error: 'Sync failed',
        details: err.message,
        duration_ms: Date.now() - startTime,
      },
      500,
    )
  }
}
