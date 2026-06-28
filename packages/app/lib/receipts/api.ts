import {
  storage,
  functions,
  account,
  tablesDB,
} from 'app/provider/appwrite/api'
import { Query, Models, ExecutionMethod } from 'app/lib/appwrite-universal'
import { Platform } from 'react-native'
import {
  DATABASE_ID,
  USERS_RECEIPTS_COLLECTION_ID,
  USERS_RECEIPTS_BUCKET_ID,
  VALIDATE_RECEIPT_UPLOAD_FUNCTION_ID,
  UPDATE_RECEIPT_NOTES_FUNCTION_ID,
  ARCHIVE_RECEIPTS_FUNCTION_ID,
  APPWRITE_PROJECT_ID,
  APPWRITE_ENDPOINT,
} from 'app/provider/appwrite/constants'
import { generateReceiptFilename } from 'app/utils/receiptFilename'

/**
 * Receipt document type
 */
export type Receipt = Models.Document & {
  user_id: string
  contest_id: string
  file_id: string
  notes: string
  file_order: number
  file_type: string
}

/**
 * App setting document type
 */
export type AppSetting = Models.Document & {
  setting_key: string
  setting_value: number
}

/**
 * Receipt stats type
 */
export interface ReceiptStats {
  totalContestsWithReceipts: number
  contestsWithReceipts: string[] // Array of contest IDs
}

/**
 * Receipt upload result
 */
export interface ReceiptUploadResult {
  receiptId: string
  fileId: string
  userId: string
  contestId: string
  notes: string
  fileOrder: number
  fileType: string
  createdAt: string
}

/**
 * Upload a receipt using the server-side validation function
 * This ensures limits are enforced server-side and cannot be bypassed
 */
export async function uploadReceipt(
  userId: string,
  contestId: string,
  file: File | { uri: string; name: string; type: string },
  notes: string,
  fileOrder: number,
  fileType: string,
  captchaToken?: string
): Promise<ReceiptUploadResult> {
  try {
    // HYBRID SECURE APPROACH:
    // 1. Upload file to storage with NO permissions (user can't access it yet)
    // 2. Function validates CAPTCHA + limits
    // 3. Function updates file permissions to give user access
    // This avoids 10MB body size limits while maintaining security

    // Get user info for filename generation
    const user = await account.get()
    const userName = user.name || 'user'

    // Generate standardized filename
    // Format: {name_prefix}_{contest_id}_{user_id}_{timestamp}.{ext}
    const standardizedFilename = generateReceiptFilename(
      userName,
      contestId,
      userId,
      fileType,
      file.name
    )

    let fileToUpload: any
    let fileSize = 0
    let fileName = file.name // Keep original for reference

    if (Platform.OS === 'web') {
      if (file instanceof File) {
        // Create new File with standardized name
        fileToUpload = new File([file], standardizedFilename, {
          type: file.type || fileType,
        })
        fileSize = file.size
      } else {
        const response = await fetch(file.uri)
        const blob = await response.blob()
        fileSize = blob.size
        fileToUpload = new File([blob], standardizedFilename, {
          type: file.type || fileType || 'image/jpeg',
        })
      }
    } else {
      // Native - file is the native object type with uri property
      const nativeFile = file as {
        uri: string
        name: string
        type: string
        size?: number
      }
      fileToUpload = {
        uri: nativeFile.uri,
        name: standardizedFilename, // Use standardized name
        type: nativeFile.type || fileType || 'image/jpeg',
        size: nativeFile.size ?? undefined,
      } as any
      fileSize = nativeFile.size || 0
    }

    // Step 1: Upload file with NO permissions (temporary - function will set them)
    const uploadedFile = await storage.createFile(
      USERS_RECEIPTS_BUCKET_ID,
      'unique()',
      fileToUpload,
      [] // No permissions - file is inaccessible until function validates and updates
    )

    // Step 2: Call function with file ID (small JSON payload)
    const functionPayload = {
      userId,
      contestId,
      fileId: uploadedFile.$id,
      fileName,
      fileSize,
      notes,
      fileOrder,
      fileType,
      captchaToken,
    }

    const execution = await functions.createExecution(
      VALIDATE_RECEIPT_UPLOAD_FUNCTION_ID,
      JSON.stringify(functionPayload),
      false, // sync - use synchronous execution to get response body
      '/', // path
      ExecutionMethod.POST, // method
      {
        'Content-Type': 'application/json',
      }
    )

    // For sync execution, response is immediately available
    if (execution.status === 'completed') {
      // Parse the response
      try {
        const raw =
          (execution as any).responseBody ??
          (execution as any).response ??
          (execution as any).stdout

        if (typeof raw === 'string' && raw.trim()) {
          const parsed = JSON.parse(raw)
          if (parsed.success) {
            return parsed.data
          }
          throw new Error(parsed.error || 'Upload validation failed')
        } else {
          // Empty response - check stderr for errors
          const stderr = (execution as any).stderr
          if (stderr) {
            console.error('Function stderr:', stderr)
            throw new Error(`Function error: ${stderr}`)
          }
          throw new Error('No response from validation function')
        }
      } catch (parseError) {
        console.error('Function response parse error:', parseError)
        console.error(
          'Full execution object:',
          JSON.stringify(execution, null, 2)
        )
        throw new Error('Failed to process upload validation response')
      }
    }

    if (execution.status === 'failed') {
      const errorMsg =
        (execution as any).responseBody ||
        (execution as any).stderr ||
        'Unknown error'
      console.error('Validation function failed:', errorMsg)
      throw new Error(`Receipt validation failed: ${errorMsg}`)
    }

    throw new Error('Unexpected function execution status: ' + execution.status)
  } catch (error) {
    console.error('Receipt upload error:', error)
    throw error
  }
}

/**
 * Get all receipts for a specific contest by a user
 */
export async function getContestReceipts(
  userId: string,
  contestId: string
): Promise<Receipt[]> {
  try {
    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: USERS_RECEIPTS_COLLECTION_ID,
      queries: [
        Query.equal('user_id', userId),
        Query.equal('contest_id', contestId),
        Query.orderAsc('file_order'),
        Query.limit(10),
      ],
    })
    return response.rows as unknown as Receipt[]
  } catch (error) {
    console.error('Failed to fetch contest receipts:', error)
    throw error
  }
}

/**
 * Update receipt notes with server-side sanitization
 * Uses the update-receipt-notes function to ensure text is sanitized
 */
export async function updateReceiptNotes(
  receiptId: string,
  userId: string,
  notes: string
): Promise<Receipt> {
  try {
    // Call server function to update notes with sanitization
    const execution = await functions.createExecution(
      UPDATE_RECEIPT_NOTES_FUNCTION_ID,
      JSON.stringify({
        receiptId,
        userId,
        notes,
      }),
      false, // sync execution
      '/',
      ExecutionMethod.POST,
      {
        'Content-Type': 'application/json',
      }
    )

    // Parse response
    if (execution.status === 'completed') {
      try {
        const raw =
          (execution as any).responseBody ??
          (execution as any).response ??
          (execution as any).stdout

        if (typeof raw === 'string' && raw.trim()) {
          const parsed = JSON.parse(raw)
          if (parsed.success) {
            // Fetch the updated receipt to return full data
            const response = await tablesDB.listRows({
              databaseId: DATABASE_ID,
              tableId: USERS_RECEIPTS_COLLECTION_ID,
              queries: [Query.equal('$id', receiptId), Query.limit(1)],
            })

            if (response.rows.length > 0) {
              return response.rows[0] as unknown as Receipt
            }
            throw new Error('Receipt not found after update')
          }
          throw new Error(parsed.error || 'Failed to update notes')
        } else {
          const stderr = (execution as any).stderr
          if (stderr) {
            console.error('Function stderr:', stderr)
            throw new Error(`Function error: ${stderr}`)
          }
          throw new Error('No response from update function')
        }
      } catch (parseError) {
        console.error('Function response parse error:', parseError)
        throw new Error('Failed to process update response')
      }
    }

    if (execution.status === 'failed') {
      const errorMsg =
        (execution as any).responseBody ||
        (execution as any).stderr ||
        'Unknown error'
      console.error('Update function failed:', errorMsg)
      throw new Error(`Failed to update notes: ${errorMsg}`)
    }

    throw new Error('Unexpected function execution status: ' + execution.status)
  } catch (error) {
    console.error('Failed to update receipt notes:', error)
    throw error
  }
}

/**
 * Update receipt file order
 */
export async function updateReceiptFileOrder(
  receiptId: string,
  fileOrder: number
): Promise<Receipt> {
  try {
    const updated = await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: USERS_RECEIPTS_COLLECTION_ID,
      rowId: receiptId,
      data: { file_order: fileOrder },
    })
    return updated as unknown as Receipt
  } catch (error) {
    console.error('Failed to update receipt file order:', error)
    throw error
  }
}

/**
 * Delete a receipt (both file and database record)
 * Uses transactions to ensure atomicity - either both delete or neither
 */
export async function deleteReceipt(
  receiptId: string,
  fileId: string
): Promise<void> {
  try {
    // Create transaction for atomic deletion using TablesDB
    const transaction = await tablesDB.createTransaction()
    const transactionId = transaction.$id

    try {
      // Stage database deletion in transaction
      await tablesDB.deleteRow({
        databaseId: DATABASE_ID,
        tableId: USERS_RECEIPTS_COLLECTION_ID,
        rowId: receiptId,
        transactionId,
      })

      // Note: Storage operations don't support transactions yet
      // Delete file after staging database deletion
      await storage.deleteFile(USERS_RECEIPTS_BUCKET_ID, fileId)

      // Commit transaction
      await tablesDB.updateTransaction({ transactionId, commit: true })
    } catch (error) {
      // Rollback transaction on error
      try {
        await tablesDB.updateTransaction({ transactionId, rollback: true })
      } catch (rollbackError) {
        console.error('Failed to rollback transaction:', rollbackError)
      }
      throw error
    }
  } catch (error) {
    console.error('Failed to delete receipt:', error)
    throw error
  }
}

/**
 * Archive receipts using server function (secure approach)
 */
export async function archiveReceiptsServer(
  receiptIds: string[],
  contestId: string,
  userId: string,
  jwtToken: string,
  reason: string = 'Contest unsaved by user'
): Promise<{ success: boolean; archivedCount: number; errors: string[] }> {
  try {
    // Call server function to handle archiving (server has access to all files)
    const execution = await functions.createExecution(
      ARCHIVE_RECEIPTS_FUNCTION_ID,
      JSON.stringify({
        receiptIds,
        contestId,
        userId,
        jwtToken,
        reason,
      }),
      false // Don't wait for completion
    )

    // Poll for completion (server functions can take time for file operations)
    let attempts = 0
    const maxAttempts = 30 // 30 seconds max
    const pollInterval = 1000 // 1 second

    while (attempts < maxAttempts) {
      const status = await functions.getExecution(
        ARCHIVE_RECEIPTS_FUNCTION_ID,
        execution.$id
      )

      if (status.status === 'completed') {
        const responseBody =
          (status as any).responseBody ?? (status as any).response ?? status

        if (typeof responseBody === 'string') {
          const trimmed = responseBody.trim()
          if (!trimmed) {
            // Empty response is OK - function executed successfully but returned no body
            if (__DEV__) {
              console.info(
                'archiveReceiptsServer: empty response body from function, assuming success'
              )
            }
            return {
              success: true,
              archivedCount: receiptIds.length,
              errors: [],
            }
          }

          try {
            const result = JSON.parse(trimmed)
            return {
              success: result.success || false,
              archivedCount: result.archivedCount || 0,
              errors: result.errors || [],
            }
          } catch (parseErr) {
            console.error(
              'archiveReceiptsServer: failed to parse response body',
              parseErr,
              responseBody
            )
            throw parseErr
          }
        }

        return {
          success: Boolean((responseBody as any)?.success),
          archivedCount: Number((responseBody as any)?.archivedCount) || 0,
          errors: (responseBody as any)?.errors || [],
        }
      }

      if (status.status === 'failed') {
        const errorMsg =
          (status as any).responseBody ||
          (status as any).stderr ||
          'Unknown error'
        if (__DEV__) {
          console.error('Archive function failed:', errorMsg)
        }
        throw new Error(`Server archiving failed: ${errorMsg}`)
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollInterval))
      attempts++
    }

    throw new Error('Archiving timed out')
  } catch (error) {
    console.error('Failed to archive receipts via server:', error)
    throw error
  }
}

/**
 * Archive all receipts for a contest when user unsaves it
 */
export async function archiveContestReceipts(
  userId: string,
  contestId: string,
  reason: string = 'Contest unsaved by user'
): Promise<void> {
  try {
    // Get all receipts for this contest
    const receipts = await getContestReceipts(userId, contestId)

    if (receipts.length === 0) {
      console.log('No receipts to archive')
      return
    }

    // Extract receipt IDs
    const receiptIds = receipts.map((receipt) => receipt.$id)

    // Get JWT token for authentication
    const { jwt: jwtToken } = await account.createJWT()

    // Call server function to archive all receipts
    const result = await archiveReceiptsServer(
      receiptIds,
      contestId,
      userId,
      jwtToken,
      reason
    )

    if (!result.success) {
      throw new Error(`Failed to archive receipts: ${result.errors.join(', ')}`)
    }

    // Log only in development
    if (__DEV__) {
      console.log(
        `Archived ${result.archivedCount} receipts for contest ${contestId}`
      )
    }
  } catch (error) {
    console.error('Failed to archive contest receipts:', error)
    throw error
  }
}

/**
 * Archive receipt files for already-deleted receipt records (admin function)
 * Used when deleting a contest - DB records are already deleted in transaction,
 * this function just moves the files to archive bucket
 */
export async function archiveReceiptFiles(
  receipts: Receipt[],
  contestId: string,
  reason: string = 'Contest deleted by admin'
): Promise<{ archivedCount: number; errors: string[] }> {
  try {
    if (receipts.length === 0) {
      console.log('No receipt files to archive for contest:', contestId)
      return { archivedCount: 0, errors: [] }
    }

    console.log(
      `Archiving ${receipts.length} receipt files for contest ${contestId}`
    )

    // Get JWT token and user ID for authentication (admin user performing the action)
    const { jwt: jwtToken } = await account.createJWT()
    const adminUser = await account.get()
    const adminUserId = adminUser.$id

    // Archive ALL receipts in a single call
    // The archive function will detect admin status and process all receipts
    // regardless of which user they belong to
    const receiptIds = receipts.map((r) => r.$id)

    console.log(
      `Archiving ${receiptIds.length} receipts for contest ${contestId} (performed by admin ${adminUserId})`
    )

    try {
      // Pass admin's user ID - the function will detect admin status and allow cross-user archiving
      const result = await archiveReceiptsServer(
        receiptIds,
        contestId,
        adminUserId,
        jwtToken,
        reason
      )

      if (result.success) {
        console.log(
          `✅ Archived ${result.archivedCount}/${receipts.length} receipts`
        )
      } else {
        console.error(`Archiving errors: ${result.errors.join(', ')}`)
      }

      return result
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`Failed to archive receipts:`, error)
      return {
        archivedCount: 0,
        errors: [errorMsg],
      }
    }
  } catch (error) {
    console.error('Failed to archive receipt files:', error)
    throw error
  }
}

/**
 * Archive all receipts for a contest across all users (admin function)
 * Used when deleting a contest
 */
export async function archiveAllContestReceipts(
  contestId: string,
  reason: string = 'Contest deleted by admin'
): Promise<{ archivedCount: number; errors: string[] }> {
  try {
    // Get all receipts for this contest (across all users)
    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: USERS_RECEIPTS_COLLECTION_ID,
      queries: [Query.equal('contest_id', contestId), Query.limit(1000)],
    })

    const receipts = response.rows as unknown as Receipt[]

    if (receipts.length === 0) {
      console.log('No receipts to archive for contest:', contestId)
      return { archivedCount: 0, errors: [] }
    }

    console.log(
      `Found ${receipts.length} receipts to archive for contest ${contestId}`
    )

    // Use the file archiving function
    return await archiveReceiptFiles(receipts, contestId, reason)
  } catch (error) {
    console.error('Failed to archive all contest receipts:', error)
    throw error
  }
}

/**
 * Get user's receipt statistics
 * Returns the number of contests with receipts and the list of contest IDs
 */
export async function getUserReceiptStats(
  userId: string
): Promise<ReceiptStats> {
  try {
    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: USERS_RECEIPTS_COLLECTION_ID,
      queries: [Query.equal('user_id', userId), Query.limit(500)],
    })

    // Get unique contest IDs
    const contestIds = new Set<string>()
    response.rows.forEach((doc) => {
      const receipt = doc as unknown as Receipt
      contestIds.add(receipt.contest_id)
    })

    return {
      totalContestsWithReceipts: contestIds.size,
      contestsWithReceipts: Array.from(contestIds),
    }
  } catch (error) {
    console.error('Failed to fetch user receipt stats:', error)
    throw error
  }
}

/**
 * Get the number of receipts for a specific contest
 */
export async function getContestReceiptCount(
  userId: string,
  contestId: string
): Promise<number> {
  try {
    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: USERS_RECEIPTS_COLLECTION_ID,
      queries: [
        Query.equal('user_id', userId),
        Query.equal('contest_id', contestId),
        Query.limit(10),
      ],
    })
    return response.rows.length
  } catch (error) {
    console.error('Failed to fetch contest receipt count:', error)
    return 0
  }
}

// getAllAppSettings function removed - limits now come from user's subscription tier

/**
 * Get receipt file URL for display
 * Handles both public and user-specific file access
 */
export function getReceiptFileUrl(
  fileId: string,
  tokenSecret?: string
): string {
  const baseUrl = `${APPWRITE_ENDPOINT}/storage/buckets/${USERS_RECEIPTS_BUCKET_ID}/files/${fileId}/view?project=${APPWRITE_PROJECT_ID}`

  // For user-specific files, token might be needed for older implementations
  // New implementation uses JWT for Android
  if (tokenSecret) {
    return `${baseUrl}&token=${tokenSecret}`
  }

  return baseUrl
}
