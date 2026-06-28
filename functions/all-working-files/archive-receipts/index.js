/*
  How to generate tar.gz file for Appwrite function:
  Create the archive from inside the folder so the files are at the root of the tarball:
  - "tar --exclude='.DS_Store' --exclude='._*' -czf ../archive-receipts.tar.gz ."
  - c → create an archive ; z → compress it with gzip ; f → specify filename
  - then, upload the tar.gz file via appwrite console
*/

const { Client, TablesDB, Storage, ID, Account } = require('node-appwrite')
const { InputFile } = require('node-appwrite/file')
const fs = require('fs')
const path = require('path')
const os = require('os')

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  INTERNAL_API_KEY,
  DATABASE_ID,
  USERS_RECEIPTS_COLLECTION_ID,
  USERS_RECEIPTS_BUCKET_ID,
  USERS_RECEIPTS_ARCHIVE_COLLECTION_ID,
  USERS_RECEIPTS_ARCHIVE_BUCKET_ID,
  ADMIN_TEAM_ID,
} = process.env

/**
 * Archive Receipts Function
 *
 * This function handles archiving receipts when a user unsaves a contest.
 * It moves receipts and their files from active storage to archive storage.
 *
 * Process:
 * 1. Validate receipt ownership
 * 2. Download files from main bucket (server has access)
 * 3. Upload files to archive bucket
 * 4. Create archive documents
 * 5. Delete original files and documents
 *
 * Security:
 * - Validates user owns receipts
 * - Archive has NO user permissions (admin only)
 * - All operations logged
 */
module.exports = async ({ req, res, log, error }) => {
  // Create two separate clients:
  // 1. JWT client for user authentication
  // 2. API Key client for admin operations

  const jwtClient = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)

  const adminClient = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(INTERNAL_API_KEY)

  const tablesDB = new TablesDB(adminClient)
  const storage = new Storage(adminClient)

  try {
    // Parse input
    const {
      receiptIds,
      contestId,
      userId,
      jwtToken,
      reason = 'Contest unsaved by user',
    } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body

    // Validate JWT and get authenticated user
    if (!jwtToken) {
      return res.json(
        {
          success: false,
          archivedCount: 0,
          errors: ['Missing JWT token'],
        },
        401
      )
    }

    let isAdmin = false
    try {
      // Use JWT client to authenticate the user
      jwtClient.setJWT(jwtToken)
      const jwtAccount = new Account(jwtClient)
      const authenticatedUser = await jwtAccount.get()
      const authenticatedUserId = authenticatedUser.$id

      // Check if user is an admin (member of admin team)
      if (ADMIN_TEAM_ID) {
        try {
          const teams = new (require('node-appwrite').Teams)(jwtClient)
          const teamMemberships = await teams.listMemberships(ADMIN_TEAM_ID)
          isAdmin = teamMemberships.memberships.some(
            (membership) => membership.userId === authenticatedUserId
          )
          if (isAdmin) {
            log(
              `User ${authenticatedUserId} is an admin - bypassing ownership validation`
            )
          }
        } catch (teamError) {
          log(`Could not check admin status: ${teamError.message}`)
          // Continue with normal ownership validation
        }
      }

      // Verify the userId in request matches authenticated user (unless admin)
      if (!isAdmin && authenticatedUserId !== userId) {
        error(
          `User ID mismatch: requested ${userId}, authenticated ${authenticatedUserId}`
        )
        return res.json(
          {
            success: false,
            archivedCount: 0,
            errors: ['Unauthorized: User ID mismatch'],
          },
          403
        )
      }

      log(
        `Authenticated user ${authenticatedUserId} requesting archive${
          isAdmin ? ' (admin)' : ''
        }`
      )
    } catch (authError) {
      error(`JWT validation failed: ${authError.message}`)
      return res.json(
        {
          success: false,
          archivedCount: 0,
          errors: ['Invalid JWT token'],
        },
        401
      )
    }

    log(
      `Archiving ${receiptIds?.length || 0} receipts for contest ${contestId}`
    )

    log(
      `InputFile available: ${InputFile ? 'yes' : 'no'}, fromPath: ${
        InputFile && typeof InputFile.fromPath === 'function' ? 'yes' : 'no'
      }`
    )

    if (!receiptIds || !Array.isArray(receiptIds) || receiptIds.length === 0) {
      return res.json(
        {
          success: false,
          archivedCount: 0,
          errors: ['No receipt IDs provided'],
        },
        400
      )
    }

    if (!contestId || !userId) {
      return res.json(
        {
          success: false,
          archivedCount: 0,
          errors: ['Missing contestId or userId'],
        },
        400
      )
    }

    let archivedCount = 0
    const errors = []

    // Create a single transaction for all receipts (atomic batch archiving)
    log('Creating transaction for atomic batch archiving...')
    const transaction = await tablesDB.createTransaction({})
    const transactionId = transaction.$id

    // Track uploaded archive files for rollback if needed
    const uploadedArchiveFiles = []

    try {
      // Process each receipt and stage operations in transaction
      for (const receiptId of receiptIds) {
        try {
          log(`Processing receipt ${receiptId}`)

          // Get receipt data
          const receipt = await tablesDB.getRow({
            databaseId: DATABASE_ID,
            tableId: USERS_RECEIPTS_COLLECTION_ID,
            rowId: receiptId,
          })

          // Check if receipt exists
          if (!receipt) {
            const msg = `Receipt ${receiptId} not found`
            error(msg)
            errors.push(msg)
            continue
          }

          log(`Receipt data: ${JSON.stringify(receipt, null, 2)}`)

          // Verify receipt belongs to contest (always required)
          if (receipt.contest_id !== contestId) {
            const msg = `Receipt ${receiptId} does not belong to contest ${contestId}`
            error(msg)
            errors.push(msg)
            continue
          }

          // Verify receipt belongs to user (skip for admins)
          if (!isAdmin && receipt.user_id !== userId) {
            const msg = `Receipt ${receiptId} does not belong to user ${userId}`
            error(msg)
            errors.push(msg)
            continue
          }

          // Log if admin is archiving another user's receipt
          if (isAdmin && receipt.user_id !== userId) {
            log(`Admin archiving receipt for user ${receipt.user_id}`)
          }

          // Get original file metadata to preserve filename
          log(`Getting file metadata for ${receipt.file_id}`)
          const originalFile = await storage.getFile(
            USERS_RECEIPTS_BUCKET_ID,
            receipt.file_id
          )
          const originalFilename = originalFile.name
          log(`Original filename: ${originalFilename}`)

          // Download file from main bucket (server has access)
          const fileUrl = `${APPWRITE_ENDPOINT}/storage/buckets/${USERS_RECEIPTS_BUCKET_ID}/files/${receipt.file_id}/view?project=${APPWRITE_PROJECT_ID}`

          log(`Downloading file ${receipt.file_id}`)
          const response = await fetch(fileUrl, {
            headers: {
              'X-Appwrite-Project': APPWRITE_PROJECT_ID,
              'X-Appwrite-Key': INTERNAL_API_KEY,
            },
          })

          if (!response.ok) {
            throw new Error(
              `Failed to download file ${receipt.file_id}: ${response.status}`
            )
          }

          const fileBuffer = await response.arrayBuffer()
          log(`File buffer size: ${fileBuffer.byteLength} bytes`)
          log(`Receipt file_type: ${receipt.file_type}`)

          // Convert ArrayBuffer to Buffer (Node.js)
          const buffer = Buffer.from(fileBuffer)
          log(`Buffer created with size: ${buffer.length} bytes`)

          // Create file in archive bucket with SAME filename
          const newFileId = ID.unique()
          log(
            `Uploading to archive bucket as ${newFileId} with filename: ${originalFilename}`
          )

          // Write buffer to temporary file (use original filename)
          const tempFilePath = path.join(os.tmpdir(), originalFilename)
          fs.writeFileSync(tempFilePath, buffer)
          log(`Temp file created at: ${tempFilePath}`)

          // Create InputFile from file path (preserves original filename)
          const inputFile = InputFile.fromPath(tempFilePath, originalFilename)
          log(`InputFile created for upload with original filename`)

          // ⚡ CRITICAL FIX: Actually upload file to archive bucket
          // Note: Storage operations don't support transactions yet, so we do this first
          log(`Uploading file to archive bucket: ${newFileId}`)
          await storage.createFile(
            USERS_RECEIPTS_ARCHIVE_BUCKET_ID,
            newFileId,
            inputFile,
            [] // No permissions - admin only access
          )
          log(`✅ File uploaded to archive bucket: ${newFileId}`)

          // Track for potential rollback
          uploadedArchiveFiles.push({
            fileId: newFileId,
            originalFileId: receipt.file_id,
          })

          // Clean up temp file
          try {
            fs.unlinkSync(tempFilePath)
            log(`Temp file deleted: ${tempFilePath}`)
          } catch (cleanupErr) {
            error(`Failed to delete temp file: ${cleanupErr.message}`)
          }

          // Create archive document in transaction
          const archiveData = {
            user_id: receipt.user_id,
            contest: receipt.contest_id,
            file_id: newFileId,
            notes: receipt.notes || '',
            file_order: receipt.file_order,
            file_type: receipt.file_type,
            archived_reason: reason,
          }
          log(`Archive data: ${JSON.stringify(archiveData, null, 2)}`)

          await tablesDB.createRow({
            databaseId: DATABASE_ID,
            tableId: USERS_RECEIPTS_ARCHIVE_COLLECTION_ID,
            rowId: ID.unique(),
            data: archiveData,
            permissions: [], // No permissions - admin only access
            transactionId,
          })

          // Stage original document deletion in transaction
          log(`Staging original document deletion in transaction`)
          await tablesDB.deleteRow({
            databaseId: DATABASE_ID,
            tableId: USERS_RECEIPTS_COLLECTION_ID,
            rowId: receiptId,
            transactionId,
          })

          // ⚡ CRITICAL FIX: Delete original file from main bucket
          // Do this AFTER successful archive upload but BEFORE transaction commit
          log(`Deleting original file from main bucket: ${receipt.file_id}`)
          await storage.deleteFile(USERS_RECEIPTS_BUCKET_ID, receipt.file_id)
          log(`✅ Original file deleted from main bucket: ${receipt.file_id}`)

          archivedCount++
        } catch (err) {
          error(`Error processing receipt ${receiptId}: ${err.message}`)
          errors.push(`Error processing receipt ${receiptId}: ${err.message}`)
        }
      }

      // Commit transaction - all archive/delete operations happen atomically
      if (archivedCount > 0) {
        log(`Committing transaction with ${archivedCount} operations...`)
        await tablesDB.updateTransaction({
          transactionId,
          commit: true,
        })
        log(
          '✅ Transaction committed successfully - all receipts archived atomically'
        )
      } else {
        log('No receipts to archive, rolling back transaction')
        await tablesDB.updateTransaction({
          transactionId,
          rollback: true,
        })
      }
    } catch (err) {
      // Rollback transaction on critical error
      error(`Critical error during archiving: ${err.message}`)

      // Rollback transaction
      try {
        await tablesDB.updateTransaction({
          transactionId,
          rollback: true,
        })
        log('Transaction rolled back due to critical error')
      } catch (rollbackErr) {
        error(`Failed to rollback transaction: ${rollbackErr.message}`)
      }

      // Clean up any files that were uploaded to archive bucket
      if (uploadedArchiveFiles.length > 0) {
        log(
          `Rolling back ${uploadedArchiveFiles.length} uploaded archive files...`
        )
        for (const { fileId } of uploadedArchiveFiles) {
          try {
            await storage.deleteFile(USERS_RECEIPTS_ARCHIVE_BUCKET_ID, fileId)
            log(`Cleaned up archive file: ${fileId}`)
          } catch (cleanupErr) {
            error(
              `Failed to cleanup archive file ${fileId}: ${cleanupErr.message}`
            )
          }
        }
      }

      errors.push(`Transaction failed: ${err.message}`)
    }

    log(
      `Archive complete: ${archivedCount}/${receiptIds.length} receipts archived`
    )

    return res.json({
      success: errors.length === 0,
      archivedCount,
      errors,
      total: receiptIds.length,
    })
  } catch (err) {
    error(`Archive receipts function error: ${err.message}`)
    return res.json(
      {
        success: false,
        archivedCount: 0,
        errors: [err.message],
      },
      500
    )
  }
}
