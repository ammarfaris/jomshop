/*
  Meilisearch Admin Function
  
  How to generate tar.gz file for Appwrite function:
  Create the archive from inside the folder so the files are at the root of the tarball:
  - "tar --exclude='.DS_Store' --exclude='._*' -czf ../meilisearch-admin.tar.gz ."
  - c → create an archive ; z → compress it with gzip ; f → specify filename
  - then, upload the tar.gz file via appwrite console
*/
const sdk = require('node-appwrite')
const { MeiliSearch } = require('meilisearch')

// Environment variables (set in Appwrite Console)
const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  INTERNAL_API_KEY,
  ADMIN_TEAM_ID,
  DATABASE_ID,
  CONTESTS_COLLECTION_ID,
  CONTEST_HOSTS_COLLECTION_ID,
  CONTEST_CATEGORIES_COLLECTION_ID,
  CONTESTS_BUCKET_ID,
  MEILISEARCH_HOST,
  MEILISEARCH_ADMIN_API_KEY, // Master/Admin key for index management
} = process.env

const CONTESTS_INDEX = 'contests'

// Create clients
const appwriteClient = new sdk.Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(INTERNAL_API_KEY)

const tablesDB = new sdk.TablesDB(appwriteClient)
const meiliSearchClient = new MeiliSearch({
  host: MEILISEARCH_HOST,
  apiKey: MEILISEARCH_ADMIN_API_KEY,
})

// Helper function to fetch hosts by IDs
async function fetchHostsByIds(hostIds) {
  if (!hostIds || hostIds.length === 0) return []

  try {
    // Use single equal query with array of IDs (OR logic)
    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: CONTEST_HOSTS_COLLECTION_ID,
      queries: [sdk.Query.equal('$id', hostIds), sdk.Query.limit(100)],
    })
    return response.rows
  } catch (error) {
    console.error('Error fetching hosts:', error)
    return []
  }
}

// Helper function to fetch categories by IDs
async function fetchCategoriesByIds(categoryIds) {
  if (!categoryIds || categoryIds.length === 0) return []

  try {
    // Use single equal query with array of IDs (OR logic)
    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: CONTEST_CATEGORIES_COLLECTION_ID,
      queries: [sdk.Query.equal('$id', categoryIds), sdk.Query.limit(200)],
    })
    return response.rows
  } catch (error) {
    console.error('Error fetching categories:', error)
    return []
  }
}

// Helper function to transform contest data for Meilisearch
async function transformContestForMeilisearch(contest) {
  // Fetch related hosts
  const hosts = await fetchHostsByIds(contest.host_ids || [])
  const hostNames = hosts.map((host) => host.name).filter(Boolean)

  // Fetch related categories and preserve order from category_ids array
  const categories = await fetchCategoriesByIds(contest.category_ids || [])

  // Create a map for quick lookup
  const categoryMap = new Map(categories.map((cat) => [cat.$id, cat]))

  // Map categories in the same order as category_ids array
  const categoryNamesEn = (contest.category_ids || [])
    .map((id) => categoryMap.get(id)?.name_en)
    .filter(Boolean)
  const categoryNamesMs = (contest.category_ids || [])
    .map((id) => categoryMap.get(id)?.name_ms)
    .filter(Boolean)

  // Generate preview image URL (contest images are public, no token needed)
  let previewImg = null
  if (contest.main_img_id) {
    previewImg = `${APPWRITE_ENDPOINT}/storage/buckets/${CONTESTS_BUCKET_ID}/files/${contest.main_img_id}/view?project=${APPWRITE_PROJECT_ID}`
  }

  return {
    id: contest.$id || contest.id,
    slug: contest.slug,
    title: contest.title,
    title_ms: contest.title_ms,
    summary: contest.summary,
    summary_ms: contest.summary_ms,
    start_date: contest.start_date,
    end_date: contest.end_date,
    preview_img: previewImg,
    host_names: hostNames,
    category_names_en: categoryNamesEn,
    category_names_ms: categoryNamesMs,
  }
}

module.exports = async function ({ req, res, error }) {
  try {
    // Parse the incoming payload
    const {
      action, // 'setup', 'sync', 'add', 'update', 'delete'
      contestId = null,
      contestData = null,
    } = JSON.parse(req.bodyText || '{}')

    if (!action) {
      return res.json({ error: 'action required' }, 400)
    }

    // Admin membership check (DEFENSE-IN-DEPTH)
    const userId = req.headers['x-appwrite-user-id']

    if (userId) {
      const teamsService = new sdk.Teams(appwriteClient)
      const membershipList = await teamsService.listMemberships(ADMIN_TEAM_ID)
      const isAdmin = (membershipList.memberships || []).some(
        (m) => m.userId === userId
      )
      if (!isAdmin) {
        return res.json({ error: 'Forbidden' }, 403)
      }
    }

    const index = meiliSearchClient.index(CONTESTS_INDEX)

    switch (action) {
      case 'setup':
        // Setup Meilisearch index with proper configuration
        await index.updateSearchableAttributes([
          'title',
          'title_ms',
          'summary',
          'summary_ms',
          'host_names',
          'category_names_en',
          'category_names_ms',
        ])

        await index.updateFilterableAttributes([
          'start_date',
          'end_date',
          'host_names',
          'category_names_en',
          'category_names_ms',
        ])

        await index.updateSortableAttributes([
          'start_date',
          'end_date',
          'title',
        ])

        return res.json({
          message: 'Meilisearch index configured successfully',
          taskUid: 'setup-complete',
        })

      case 'sync':
        // Sync all contests from Appwrite to Meilisearch
        console.log('🔄 Starting Meilisearch sync...')

        // First, clear the entire index to ensure clean sync
        console.log('🗑️ Clearing existing Meilisearch index...')
        try {
          const deleteTask = await index.deleteAllDocuments()
          console.log('✅ Index cleared, task UID:', deleteTask.taskUid)
        } catch (deleteError) {
          console.warn(
            '⚠️ Could not clear index (might be empty):',
            deleteError.message
          )
        }

        // Fetch all contests from Appwrite
        console.log('📥 Fetching contests from Appwrite...')
        const response = await tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: CONTESTS_COLLECTION_ID,
          queries: [], // No queries - get all rows
        })
        console.log(`📊 Found ${response.rows.length} contests in Appwrite`)

        // Transform Appwrite documents for Meilisearch with related data
        const contests = []
        console.log('🔄 Transforming contests with host/category data...')
        for (let i = 0; i < response.rows.length; i++) {
          const doc = response.rows[i]
          console.log(
            `  Processing contest ${i + 1}/${response.rows.length}: ${
              doc.title
            }`
          )
          const transformedContest = await transformContestForMeilisearch(doc)
          contests.push(transformedContest)
        }

        // Add all transformed contests to Meilisearch
        console.log('📤 Adding contests to Meilisearch...')
        const syncTask = await index.addDocuments(contests)
        console.log('✅ Sync completed successfully')

        return res.json({
          message: `Successfully synced ${contests.length} contests to Meilisearch`,
          taskUid: syncTask.taskUid,
          count: contests.length,
          cleared: true,
        })

      case 'add':
      case 'update':
        // Add or update a single contest
        if (!contestData) {
          return res.json({ error: 'contestData required for add/update' }, 400)
        }

        const transformedContest = await transformContestForMeilisearch(
          contestData
        )

        const addTask = await index.addDocuments([transformedContest])

        return res.json({
          message: `Contest ${action}d in Meilisearch`,
          taskUid: addTask.taskUid,
          contestId: transformedContest.id,
        })

      case 'delete':
        // Delete a contest from Meilisearch
        if (!contestId) {
          return res.json({ error: 'contestId required for delete' }, 400)
        }

        const deleteTask = await index.deleteDocument(contestId)

        return res.json({
          message: 'Contest deleted from Meilisearch',
          taskUid: deleteTask.taskUid,
          contestId,
        })

      default:
        return res.json({ error: 'Invalid action' }, 400)
    }
  } catch (e) {
    error(e)
    return res.json({ error: e.message }, 500)
  }
}
