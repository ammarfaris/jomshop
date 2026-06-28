/*
  How to generate tar.gz file for Appwrite function:
  Create the archive from inside the folder so the files are at the root of the tarball:
  - "tar --exclude='.DS_Store' --exclude='._*' -czf ../cleanup-orphaned-receipts.tar.gz ."
  - c → create an archive ; z → compress it with gzip ; f → specify filename
  - then, upload the tar.gz file via appwrite console
*/

const { Client, Storage, TablesDB, Query } = require('node-appwrite')

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  INTERNAL_API_KEY,
  DATABASE_ID,
  USERS_RECEIPTS_COLLECTION_ID,
  USERS_RECEIPTS_BUCKET_ID,
} = process.env

/**
 * Cleanup Orphaned Receipts Function
 *
 * This function runs on a schedule (e.g., hourly) to clean up orphaned receipt files.
 * Orphaned files are those that were uploaded but never validated (empty permissions).
 *
 * Scenarios that create orphaned files:
 * 1. User uploads file but network error before calling validation function
 * 2. User uploads file but closes browser before validation completes
 * 3. Validation function fails after file upload but before permission update
 *
 * Schedule: "0 * * * *" (every hour at minute 0)
 */
module.exports = async ({ req, res, log, error }) => {
  log('Cleanup orphaned receipts function started')

  // Initialize Appwrite client
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(INTERNAL_API_KEY)

  const storage = new Storage(client)
  const tablesDB = new TablesDB(client)

  try {
    // Configuration
    const ORPHAN_AGE_THRESHOLD_MS = 60 * 60 * 1000 // 1 hour in milliseconds
    const MAX_FILES_TO_CHECK = 100 // Limit per execution to prevent timeout
    const BATCH_SIZE = 10 // Process in batches

    log(
      `Configuration: Threshold=${ORPHAN_AGE_THRESHOLD_MS}ms, MaxFiles=${MAX_FILES_TO_CHECK}, BatchSize=${BATCH_SIZE}`
    )

    // Step 1: Get all files from bucket
    log('Fetching files from bucket...')
    const filesResponse = await storage.listFiles(USERS_RECEIPTS_BUCKET_ID, [
      Query.limit(MAX_FILES_TO_CHECK),
    ])

    const totalFiles = filesResponse.total
    const filesToCheck = filesResponse.files
    log(
      `Found ${filesToCheck.length} files to check (total in bucket: ${totalFiles})`
    )

    if (filesToCheck.length === 0) {
      log('No files to check, exiting')
      return res.json({
        success: true,
        message: 'No files to check',
        stats: {
          totalFiles: 0,
          orphanedFiles: 0,
          deletedFiles: 0,
          errors: 0,
        },
      })
    }

    // Step 2: Identify orphaned files
    const now = Date.now()
    const orphanedFiles = []

    for (const file of filesToCheck) {
      // Check if file has empty permissions (orphaned)
      const hasNoPermissions =
        !file.$permissions || file.$permissions.length === 0

      if (hasNoPermissions) {
        // Check age - only delete if older than threshold
        const fileCreatedAt = new Date(file.$createdAt).getTime()
        const fileAge = now - fileCreatedAt

        if (fileAge > ORPHAN_AGE_THRESHOLD_MS) {
          orphanedFiles.push({
            id: file.$id,
            name: file.name,
            size: file.sizeOriginal,
            createdAt: file.$createdAt,
            ageMs: fileAge,
            ageMinutes: Math.round(fileAge / 60000),
          })
        } else {
          log(
            `File ${
              file.$id
            } has no permissions but is too recent (${Math.round(
              fileAge / 60000
            )} minutes old), skipping`
          )
        }
      }
    }

    log(
      `Identified ${orphanedFiles.length} orphaned files older than ${
        ORPHAN_AGE_THRESHOLD_MS / 60000
      } minutes`
    )

    if (orphanedFiles.length === 0) {
      log('No orphaned files to clean up')
      return res.json({
        success: true,
        message: 'No orphaned files found',
        stats: {
          totalFiles: filesToCheck.length,
          orphanedFiles: 0,
          deletedFiles: 0,
          errors: 0,
        },
      })
    }

    // Step 3: Verify files are truly orphaned (no database record)
    log('Verifying files have no database records...')
    const verifiedOrphans = []

    for (const file of orphanedFiles) {
      try {
        // Check if file has a corresponding database record
        const receipts = await tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: USERS_RECEIPTS_COLLECTION_ID,
          queries: [Query.equal('file_id', file.id), Query.limit(1)],
        })

        if (receipts.total === 0) {
          // No database record - truly orphaned
          verifiedOrphans.push(file)
          log(`✓ File ${file.id} is orphaned (no DB record)`)
        } else {
          // Has database record - not orphaned, just missing permissions (edge case)
          log(
            `⚠️ File ${file.id} has DB record but no permissions - skipping deletion (needs investigation)`
          )
        }
      } catch (err) {
        error(`Failed to check database for file ${file.id}: ${err.message}`)
        // Skip this file to be safe
      }
    }

    log(`Verified ${verifiedOrphans.length} truly orphaned files`)

    if (verifiedOrphans.length === 0) {
      log('No verified orphaned files to delete')
      return res.json({
        success: true,
        message: 'No verified orphaned files',
        stats: {
          totalFiles: filesToCheck.length,
          orphanedFiles: orphanedFiles.length,
          verifiedOrphans: 0,
          deletedFiles: 0,
          errors: 0,
        },
      })
    }

    // Step 4: Delete orphaned files in batches
    log(`Deleting ${verifiedOrphans.length} orphaned files...`)
    const deletedFiles = []
    const deletionErrors = []

    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < verifiedOrphans.length; i += BATCH_SIZE) {
      const batch = verifiedOrphans.slice(i, i + BATCH_SIZE)
      log(
        `Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${
          batch.length
        } files)`
      )

      const deletePromises = batch.map(async (file) => {
        try {
          await storage.deleteFile(USERS_RECEIPTS_BUCKET_ID, file.id)
          deletedFiles.push(file)
          log(
            `✓ Deleted orphaned file: ${file.id} (${file.name}, ${file.size} bytes, age: ${file.ageMinutes} minutes)`
          )
          return { success: true, fileId: file.id }
        } catch (err) {
          error(`✗ Failed to delete file ${file.id}: ${err.message}`)
          deletionErrors.push({
            fileId: file.id,
            fileName: file.name,
            error: err.message,
          })
          return { success: false, fileId: file.id, error: err.message }
        }
      })

      // Wait for batch to complete before moving to next batch
      await Promise.all(deletePromises)

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < verifiedOrphans.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    // Step 5: Calculate statistics
    const totalSizeDeleted = deletedFiles.reduce(
      (sum, file) => sum + file.size,
      0
    )
    const totalSizeMB = (totalSizeDeleted / (1024 * 1024)).toFixed(2)

    const stats = {
      totalFiles: filesToCheck.length,
      orphanedFiles: orphanedFiles.length,
      verifiedOrphans: verifiedOrphans.length,
      deletedFiles: deletedFiles.length,
      deletedSizeBytes: totalSizeDeleted,
      deletedSizeMB: totalSizeMB,
      errors: deletionErrors.length,
      errorDetails: deletionErrors,
    }

    log('=== Cleanup Summary ===')
    log(`Total files checked: ${stats.totalFiles}`)
    log(`Orphaned files found: ${stats.orphanedFiles}`)
    log(`Verified orphans: ${stats.verifiedOrphans}`)
    log(`Successfully deleted: ${stats.deletedFiles}`)
    log(`Storage freed: ${stats.deletedSizeMB} MB`)
    log(`Errors: ${stats.errors}`)

    // Return success with detailed stats
    return res.json({
      success: true,
      message: `Cleaned up ${stats.deletedFiles} orphaned files (${stats.deletedSizeMB} MB)`,
      stats,
      deletedFiles: deletedFiles.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        ageMinutes: f.ageMinutes,
      })),
    })
  } catch (err) {
    error('Unexpected error in cleanup-orphaned-receipts function')
    error(err.message)
    error(err.stack)

    return res.json(
      {
        success: false,
        error: 'Failed to cleanup orphaned receipts',
        errorDetails: err.message,
      },
      500
    )
  }
}
