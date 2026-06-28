/*
  How to generate tar.gz file for Appwrite function:
  Create the archive from inside the folder so the files are at the root of the tarball:
  - "tar --exclude='.DS_Store' --exclude='._*' -czf ../update-receipt-notes.tar.gz ."
  - c → create an archive ; z → compress it with gzip ; f → specify filename
  - then, upload the tar.gz file via appwrite console
*/

const { Client, TablesDB, Functions, Query } = require('node-appwrite')

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  INTERNAL_API_KEY,
  DATABASE_ID,
  SANITIZE_TEXT_FUNCTION_ID,
  USERS_RECEIPTS_COLLECTION_ID,
} = process.env

/**
 * Update Receipt Notes Function
 *
 * This function securely updates receipt notes with server-side text sanitization.
 * It ensures that only the receipt owner can update notes and that all text is
 * sanitized to prevent XSS attacks.
 */

module.exports = async ({ req, res, log, error }) => {
  log('Update receipt notes function called')

  // Initialize Appwrite client
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(INTERNAL_API_KEY)

  const tablesDB = new TablesDB(client)
  const functions = new Functions(client)

  try {
    // Parse request
    let requestData
    try {
      if (typeof req.body === 'object') {
        requestData = req.body
      } else {
        requestData = JSON.parse(req.body)
      }
    } catch (err) {
      error('Request parsing failed:', err.message)
      return res.json(
        {
          success: false,
          error: 'Invalid request body',
        },
        400
      )
    }

    const { receiptId, userId, notes } = requestData

    // Validate required fields
    if (!receiptId || !userId) {
      return res.json(
        {
          success: false,
          error: 'Missing required fields: receiptId and userId',
        },
        400
      )
    }

    // Validate notes (can be empty string to clear notes)
    if (typeof notes !== 'string') {
      return res.json(
        {
          success: false,
          error: 'Notes must be a string!',
        },
        400
      )
    }

    log(`Update notes request for receipt ${receiptId} by user ${userId}`)

    // Step 1: Verify receipt ownership
    log('Verifying receipt ownership...')
    let receipt
    try {
      const receiptsResponse = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: USERS_RECEIPTS_COLLECTION_ID,
        queries: [
          Query.equal('$id', receiptId),
          Query.equal('user_id', userId),
          Query.limit(1),
        ],
      })

      if (receiptsResponse.rows.length === 0) {
        log(`Receipt ${receiptId} not found or not owned by user ${userId}`)
        return res.json(
          {
            success: false,
            error: 'Receipt not found or access denied',
          },
          403
        )
      }

      receipt = receiptsResponse.rows[0]
      log(`Receipt ownership verified for user ${userId}`)
    } catch (err) {
      error('Failed to verify receipt ownership:', err.message)
      return res.json(
        {
          success: false,
          error: 'Failed to verify receipt ownership',
        },
        500
      )
    }

    // Step 2: Sanitize notes text
    let sanitizedNotes = ''
    if (notes.trim()) {
      log('Sanitizing notes text...')
      try {
        const sanitizeExecution = await functions.createExecution(
          SANITIZE_TEXT_FUNCTION_ID,
          JSON.stringify({ text: notes, max_length: 200 }),
          false
        )

        const sanitizeData = JSON.parse(
          sanitizeExecution.responseBody ||
            sanitizeExecution.response ||
            sanitizeExecution.stdout
        )

        if (!sanitizeData.success) {
          error(`Sanitization failed: ${sanitizeData.error}`)
          return res.json(
            {
              success: false,
              error: 'Invalid content in notes',
            },
            400
          )
        }

        sanitizedNotes = sanitizeData.sanitized || ''

        // Log if dangerous content was detected
        if (sanitizeData.hadDangerousContent) {
          log('⚠️ Dangerous content detected and removed from notes')
        }

        log(
          `Notes sanitized successfully (${sanitizeData.sanitized_length} chars)`
        )
      } catch (err) {
        error('Sanitization error:', err.message)
        return res.json(
          {
            success: false,
            error: 'Failed to sanitize notes',
          },
          500
        )
      }
    } else {
      log('Notes are empty, clearing notes field')
    }

    // Step 3: Update receipt notes in database
    log('Updating receipt notes in database...')
    try {
      const updatedReceipt = await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: USERS_RECEIPTS_COLLECTION_ID,
        rowId: receiptId,
        data: { notes: sanitizedNotes },
      })

      log(`Receipt notes updated successfully: ${receiptId}`)

      return res.json(
        {
          success: true,
          data: {
            receiptId: updatedReceipt.$id,
            notes: sanitizedNotes,
            updatedAt: updatedReceipt.$updatedAt,
          },
        },
        200
      )
    } catch (err) {
      error('Failed to update receipt notes:', err.message)
      return res.json(
        {
          success: false,
          error: 'Failed to update receipt notes',
        },
        500
      )
    }
  } catch (err) {
    error('Unexpected error in update-receipt-notes function')
    error(err.message)
    error(err.stack)

    return res.json(
      {
        success: false,
        error:
          'An unexpected error occurred while updating notes. Please try again.',
      },
      500
    )
  }
}
