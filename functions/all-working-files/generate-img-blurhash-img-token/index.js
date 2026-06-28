/*
  How to generate tar.gz file for Appwrite function:
  Create the archive from inside the folder so the files are at the root of the tarball:
  - "tar --exclude='.DS_Store' --exclude='._*' -czf ../generate-img-blurhash-img-token.tar.gz ."
  - c → create an archive ; z → compress it with gzip ; f → specify filename
  - then,  upload the tar.gz file via appwrite console
*/
const sdk = require('node-appwrite')
const { Query } = sdk
const sharp = require('sharp')
const { encode } = require('blurhash')

// AVAILABLE ENV VARIABLES (auto set by appwrite) - but we don't use any for now
// https://appwrite.io/docs/products/functions/develop#environment-variables
const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  INTERNAL_API_KEY,
  ADMIN_TEAM_ID,
  CONTESTS_BUCKET_ID,
  DATABASE_ID, // Appwrite DB that holds contest data
  CONTEST_FILES_COLLECTION_ID, // collection id: contestFiles
} = process.env

const client = new sdk.Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(INTERNAL_API_KEY)

module.exports = async function ({ req, res, error }) {
  try {
    // 1. Parse the incoming payload
    const {
      fileId,
      contestId = null, // optional: when provided we persist to contestFiles
      bucketId = CONTESTS_BUCKET_ID, // allow callers to specify bucket; defaults to contests
      file_label = null,
      file_order = null,
      preview_img_width = null,
      preview_img_height = null,
      skipBlurhash = false, // option to skip blurhash generation (for OG images)
      skipToken = false, // option to skip token generation (for public files)
    } = JSON.parse(req.bodyText || '{}')
    if (!fileId) {
      return res.json({ error: 'fileId required' }, 400)
    }

    // 2. Admin membership check (DEFENSE-IN-DEPTH)
    const userId = req.headers['x-appwrite-user-id']

    const teamsService = new sdk.Teams(client)
    const membershipList = await teamsService.listMemberships(ADMIN_TEAM_ID)
    // Guard against empty team list
    const isAdmin = (membershipList.memberships || []).some(
      (m) => m.userId === userId
    )
    if (!isAdmin) {
      return res.json({ error: 'Forbidden' }, 403)
    }

    // 3. Authenticate as the function
    const storage = new sdk.Storage(client)
    const tablesDB = new sdk.TablesDB(client)
    const tokens = new sdk.Tokens(client)

    // 4. Download the file (only if blurhash is needed)
    let hash = null
    if (!skipBlurhash) {
      const buffer = await storage.getFileDownload({
        bucketId,
        fileId,
      })

      // 5. Resize + encode BlurHash
      const { data, info } = await sharp(buffer)
        .raw()
        .ensureAlpha()
        .resize(32, 32, { fit: 'inside' })
        .toBuffer({ resolveWithObject: true })

      hash = encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3)
    }

    // --- Create or reuse a single permanent token for this file (unless skipToken is true) ---
    let token = null
    if (!skipToken) {
      try {
        if (typeof tokens.listFileTokens === 'function') {
          const tokensList = await tokens.listFileTokens({
            bucketId,
            fileId,
            queries: [Query.limit(1)],
          })
          if (tokensList.total > 0) {
            token = tokensList.tokens[0]
          }
        }
      } catch (err) {
        // Older SDK may not implement listFileTokens; fall through to create
      }

      if (!token) {
        token = await tokens.createFileToken({
          bucketId,
          fileId,
        })
      }
    }

    // --- Persist to contestFiles collection only when contestId is provided ---
    if (contestId) {
      const documentData = {
        contest_id: contestId, // required
        file_id: fileId, // required
        preview_img_width,
        preview_img_height,
        file_label,
        file_order,
      }

      // Only include token if it was generated
      if (token) {
        documentData.token_id = token.$id
        documentData.token_secret = token.secret
      }

      // Only include blurhash if it was generated
      if (hash !== null) {
        documentData.img_blurhash = hash
      }

      await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: CONTEST_FILES_COLLECTION_ID,
        rowId: 'unique()',
        data: documentData,
      })
    }

    // 6. Return the hash as JSON with token (if generated)
    const response = {
      blurhash: hash,
    }

    if (token) {
      response.tokenId = token.$id
      response.tokenSecret = token.secret
    }

    return res.json(response)
  } catch (e) {
    error(e)
    return res.json({ error: e.message }, 500)
  }
}
