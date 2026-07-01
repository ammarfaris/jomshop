import { Platform } from 'react-native'
import { getSupabase } from './client'
import {
  generateTimestamp,
  getFileExtension,
} from 'app/utils/receiptFilename'
import type { Document } from 'app/lib/types'

/** A saved receipt, in the Appwrite-compatible envelope the UI consumes. */
export type Receipt = Document & {
  user_id: string
  contest_id: string
  file_id: string
  notes: string
  file_order: number
  file_type: string
}

export interface ReceiptStats {
  totalContestsWithReceipts: number
  /** Contest IDs the user has at least one receipt for. */
  contestsWithReceipts: string[]
}

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

// Supabase `public.receipts` row shape.
type ReceiptRow = {
  id: string
  user_id: string
  contest_id: string
  file_id: string
  notes: string | null
  file_type: string
  file_order: number
  created_at: string
}

const RECEIPTS_BUCKET = 'receipts'
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour

async function currentUid(): Promise<string | null> {
  const { data } = await getSupabase().auth.getUser()
  return data.user?.id ?? null
}

/** Map a Postgres row to the Appwrite-flavored Receipt the UI already expects. */
function mapReceiptRow(row: ReceiptRow): Receipt {
  return {
    $id: row.id,
    $createdAt: row.created_at,
    $updatedAt: row.created_at,
    $permissions: [],
    $collectionId: 'receipts',
    $databaseId: 'supabase',
    user_id: row.user_id,
    contest_id: row.contest_id,
    file_id: row.file_id,
    notes: row.notes ?? '',
    file_order: row.file_order,
    file_type: row.file_type,
  } as unknown as Receipt
}

/**
 * Calls the `receipts` Edge Function and unwraps `{ success, data, error }`,
 * surfacing the server-provided error message (limits/CAPTCHA/rate-limit).
 */
async function invokeReceipts<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke('receipts', {
    body,
  })

  if (error) {
    let message = error.message
    try {
      // FunctionsHttpError carries the original Response in `context`.
      const ctx = (error as { context?: { json?: () => Promise<any> } }).context
      if (ctx?.json) {
        const parsed = await ctx.json()
        if (parsed?.error) {
          // Include the server-side detail (e.g. the underlying Postgres error)
          // so failures surface the real cause instead of a generic message.
          message = parsed.detail
            ? `${parsed.error}: ${parsed.detail}`
            : parsed.error
        }
      }
    } catch {
      // fall back to the generic message
    }
    throw new Error(message)
  }

  const payload = data as { success: boolean; error?: string; data?: T }
  if (!payload?.success) {
    throw new Error(payload?.error || 'Request failed')
  }
  return payload.data as T
}

/** Read picked-file bytes in a way that works on both web and native. */
async function fileToUploadBody(
  file: File | { uri: string; name: string; type: string },
  fileType: string,
): Promise<{ body: Blob | ArrayBuffer; contentType: string }> {
  if (Platform.OS === 'web') {
    if (typeof File !== 'undefined' && file instanceof File) {
      return { body: file, contentType: file.type || fileType }
    }
    if (typeof Blob !== 'undefined' && file instanceof Blob) {
      return { body: file, contentType: (file as Blob).type || fileType }
    }
    const res = await fetch((file as { uri: string }).uri)
    const blob = await res.blob()
    return { body: blob, contentType: blob.type || fileType }
  }

  // Native: read the local file:// URI into an ArrayBuffer (most reliable body
  // type for supabase-js storage uploads on React Native).
  const res = await fetch((file as { uri: string }).uri)
  const arrayBuffer = await res.arrayBuffer()
  return { body: arrayBuffer, contentType: fileType }
}

/**
 * Upload a receipt:
 *  1. push the file straight to `receipts/<uid>/<contestId>/...` (storage RLS
 *     confines it to the caller's own prefix), then
 *  2. finalize via the Edge Function which verifies CAPTCHA + tier limits +
 *     rate limit, sanitizes the notes and creates the DB row (service role).
 * On validation failure the function deletes the orphaned object.
 */
export async function uploadReceiptSupabase(
  userId: string,
  contestId: string,
  file: File | { uri: string; name: string; type: string },
  notes: string,
  _fileOrder: number,
  fileType: string,
  captchaToken?: string,
): Promise<ReceiptUploadResult> {
  const ext = getFileExtension(fileType, (file as { name?: string }).name)
  const rand = Math.random().toString(36).slice(2, 10)
  const path = `${userId}/${contestId}/${generateTimestamp()}_${rand}.${ext}`

  const { body, contentType } = await fileToUploadBody(file, fileType)

  const { error: uploadError } = await getSupabase()
    .storage.from(RECEIPTS_BUCKET)
    .upload(path, body, { contentType, upsert: false })
  if (uploadError) throw new Error(uploadError.message)

  const row = await invokeReceipts<ReceiptRow>({
    action: 'upload',
    contestId,
    fileId: path,
    fileType,
    notes,
    captchaToken,
  })

  return {
    receiptId: row.id,
    fileId: row.file_id,
    userId: row.user_id,
    contestId: row.contest_id,
    notes: row.notes ?? '',
    fileOrder: row.file_order,
    fileType: row.file_type,
    createdAt: row.created_at,
  }
}

export async function getContestReceiptsSupabase(
  contestId: string,
): Promise<Receipt[]> {
  const uid = await currentUid()
  if (!uid) return []

  const { data, error } = await getSupabase()
    .from('receipts')
    .select('*')
    .eq('user_id', uid)
    .eq('contest_id', contestId)
    .order('file_order', { ascending: true })
    .limit(50)
  if (error) throw error
  return ((data ?? []) as ReceiptRow[]).map(mapReceiptRow)
}

export async function getUserReceiptStatsSupabase(): Promise<ReceiptStats> {
  const uid = await currentUid()
  if (!uid) return { totalContestsWithReceipts: 0, contestsWithReceipts: [] }

  const { data, error } = await getSupabase()
    .from('receipts')
    .select('contest_id')
    .eq('user_id', uid)
    .limit(1000)
  if (error) throw error

  const set = new Set(
    (data ?? []).map((r) => (r as { contest_id: string }).contest_id),
  )
  return {
    totalContestsWithReceipts: set.size,
    contestsWithReceipts: Array.from(set),
  }
}

export async function getContestReceiptCountSupabase(
  contestId: string,
): Promise<number> {
  const uid = await currentUid()
  if (!uid) return 0

  const { count, error } = await getSupabase()
    .from('receipts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid)
    .eq('contest_id', contestId)
  if (error) return 0
  return count ?? 0
}

/**
 * Owner-scoped signed URLs for display — minted client-side in ONE request via
 * the user's session (RLS confines them to their own files). No Edge Function
 * round-trip needed for reads.
 */
export async function getReceiptSignedUrlsSupabase(
  fileIds: string[],
): Promise<Record<string, string>> {
  if (fileIds.length === 0) return {}

  const { data, error } = await getSupabase()
    .storage.from(RECEIPTS_BUCKET)
    .createSignedUrls(fileIds, SIGNED_URL_TTL_SECONDS)
  if (error) throw error

  const map: Record<string, string> = {}
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl
  }
  return map
}

export async function updateReceiptNotesSupabase(
  receiptId: string,
  notes: string,
): Promise<Receipt> {
  const row = await invokeReceipts<ReceiptRow>({
    action: 'update-notes',
    receiptId,
    notes,
  })
  return mapReceiptRow(row)
}

/** file_order reorder is limit-neutral, so it goes straight through RLS. */
export async function updateReceiptFileOrderSupabase(
  receiptId: string,
  fileOrder: number,
): Promise<void> {
  const { error } = await getSupabase()
    .from('receipts')
    .update({ file_order: fileOrder })
    .eq('id', receiptId)
  if (error) throw error
}

/** Delete is owner-scoped (RLS): remove the row then the object. */
export async function deleteReceiptSupabase(
  receiptId: string,
  fileId: string,
): Promise<void> {
  const supabase = getSupabase()

  const { error: rowError } = await supabase
    .from('receipts')
    .delete()
    .eq('id', receiptId)
  if (rowError) throw rowError

  const { error: fileError } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .remove([fileId])
  if (fileError) {
    // Row is gone; a leftover object is harmless and can be GC'd later.
    console.warn('Failed to remove receipt object:', fileError.message)
  }
}

/**
 * Archive every receipt this user has for a contest (used on unsave). Routed
 * through the Edge Function because the archive bucket is service-role only.
 */
export async function archiveContestReceiptsSupabase(
  contestId: string,
  reason = 'Contest unsaved by user',
): Promise<void> {
  await invokeReceipts<unknown>({ action: 'archive', contestId, reason })
}

/**
 * Admin-only: archive EVERY user's receipts for a contest before deleting it
 * (the contest FK cascade would otherwise drop the receipt rows). The Edge
 * Function re-checks admin privileges; throws if archiving isn't fully clean so
 * the caller can abort the delete rather than lose receipts.
 */
export async function archiveAllContestReceiptsAsAdminSupabase(
  contestId: string,
  reason = 'Contest deleted by admin',
): Promise<void> {
  await invokeReceipts<unknown>({ action: 'archive-contest', contestId, reason })
}
