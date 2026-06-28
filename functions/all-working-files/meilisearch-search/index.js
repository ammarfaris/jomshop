/*
  Meilisearch Search Function
  
  How to generate tar.gz file for Appwrite function:
  Create the archive from inside the folder so the files are at the root of the tarball:
  - "tar --exclude='.DS_Store' --exclude='._*' -czf ../meilisearch-search.tar.gz ."
  - c → create an archive ; z → compress it with gzip ; f → specify filename
  - then, upload the tar.gz file via appwrite console
*/
const { MeiliSearch } = require('meilisearch')

// Environment variables (set in Appwrite Console)
const {
  MEILISEARCH_HOST,
  MEILISEARCH_SEARCH_API_KEY, // Read-only search key
} = process.env

const CONTESTS_INDEX = 'contests'

// Create MeiliSearch client
const meiliSearchClient = new MeiliSearch({
  host: MEILISEARCH_HOST,
  apiKey: MEILISEARCH_SEARCH_API_KEY,
})

module.exports = async function ({ req, res, error }) {
  try {
    // Parse the incoming payload
    const {
      query = '',
      filters = {},
      sort = [],
      limit = 20,
      offset = 0,
      attributesToRetrieve = ['*'],
      attributesToHighlight = ['title', 'summary'],
      facets = [],
    } = JSON.parse(req.bodyText || '{}')

    // Build search parameters for MeiliSearch
    const searchParams = {
      limit,
      offset,
      attributesToRetrieve,
      attributesToHighlight,
    }

    // Add facets if provided (as top-level parameter for MeiliSearch)
    if (facets && facets.length > 0) {
      searchParams.facets = facets
    }

    // Add filters if provided
    if (Object.keys(filters).length > 0) {
      const filterStrings = []

      for (const [key, value] of Object.entries(filters)) {
        if (Array.isArray(value)) {
          // Handle array filters (e.g., status IN ['active', 'upcoming'])
          const valueStrings = value.map((v) => `"${v}"`).join(', ')
          filterStrings.push(`${key} IN [${valueStrings}]`)
        } else {
          // Handle single value filters
          filterStrings.push(`${key} = "${value}"`)
        }
      }

      searchParams.filter = filterStrings
    }

    // Add sorting if provided
    if (sort.length > 0) {
      searchParams.sort = sort
    }

    // Perform search with correct MeiliSearch API
    const index = meiliSearchClient.index(CONTESTS_INDEX)
    const searchResults = await index.search(query, searchParams)

    // Return results
    return res.json({
      hits: searchResults.hits,
      query: searchResults.query,
      processingTimeMs: searchResults.processingTimeMs,
      limit: searchResults.limit,
      offset: searchResults.offset,
      estimatedTotalHits: searchResults.estimatedTotalHits,
      facetDistribution: searchResults.facetDistribution,
    })
  } catch (e) {
    error(e)
    return res.json({ error: e.message }, 500)
  }
}
