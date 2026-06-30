import { getSupabase } from './client'
import { fetchContestsByIdsSupabase } from './contests'

async function currentUid(): Promise<string | null> {
  const { data } = await getSupabase().auth.getUser()
  return data.user?.id ?? null
}

// ===========================================================================
// Upvotes. RLS limits rows to the owner; a DB trigger keeps
// contests.upvote_count in sync, so the count is read from there.
// ===========================================================================

export async function checkUserUpvoteSupabase(
  contestId: string,
): Promise<boolean> {
  const uid = await currentUid()
  if (!uid) return false

  const { data, error } = await getSupabase()
    .from('upvotes')
    .select('id')
    .eq('contest_id', contestId)
    .eq('user_id', uid)
    .maybeSingle()

  if (error) return false
  return Boolean(data)
}

export async function getUpvoteCountSupabase(contestId: string): Promise<number> {
  const { data, error } = await getSupabase()
    .from('contests')
    .select('upvote_count')
    .eq('id', contestId)
    .maybeSingle()

  if (error || !data) return 0
  return (data as { upvote_count: number | null }).upvote_count ?? 0
}

export async function createUpvoteSupabase(contestId: string): Promise<void> {
  const uid = await currentUid()
  if (!uid) throw new Error('User not authenticated')

  // Idempotent: a duplicate upvote is a no-op (so the trigger never double-counts).
  const { error } = await getSupabase()
    .from('upvotes')
    .upsert(
      { contest_id: contestId, user_id: uid },
      { onConflict: 'contest_id,user_id', ignoreDuplicates: true },
    )

  if (error) throw error
}

export async function removeUpvoteSupabase(contestId: string): Promise<void> {
  const uid = await currentUid()
  if (!uid) throw new Error('User not authenticated')

  const { error } = await getSupabase()
    .from('upvotes')
    .delete()
    .eq('contest_id', contestId)
    .eq('user_id', uid)

  if (error) throw error
}

/**
 * Batch the current user's upvote + save status for a set of contests in just
 * TWO queries (instead of 2N per-card lookups). Used by EngagementProvider to
 * seed the per-card caches for list screens.
 */
export async function fetchEngagementBatchSupabase(
  contestIds: string[],
): Promise<{ upvoted: Set<string>; saved: Set<string> }> {
  const empty = { upvoted: new Set<string>(), saved: new Set<string>() }
  const uid = await currentUid()
  if (!uid || contestIds.length === 0) return empty

  const supabase = getSupabase()
  const [upvotesRes, savesRes] = await Promise.all([
    supabase
      .from('upvotes')
      .select('contest_id')
      .eq('user_id', uid)
      .in('contest_id', contestIds),
    supabase
      .from('saves')
      .select('contest_id')
      .eq('user_id', uid)
      .in('contest_id', contestIds),
  ])

  if (upvotesRes.error) throw upvotesRes.error
  if (savesRes.error) throw savesRes.error

  return {
    upvoted: new Set(
      (upvotesRes.data ?? []).map((r) => (r as { contest_id: string }).contest_id),
    ),
    saved: new Set(
      (savesRes.data ?? []).map((r) => (r as { contest_id: string }).contest_id),
    ),
  }
}

// ===========================================================================
// Saves (+ auto-upvote). RLS limits rows to the owner.
// ===========================================================================

export interface SaveWithAutoUpvoteResult {
  success: boolean
  autoUpvoted: boolean
  warning?: string
}

export async function checkUserSaveSupabase(
  contestId: string,
): Promise<boolean> {
  const uid = await currentUid()
  if (!uid) return false

  const { data, error } = await getSupabase()
    .from('saves')
    .select('id')
    .eq('contest_id', contestId)
    .eq('user_id', uid)
    .maybeSingle()

  if (error) return false
  return Boolean(data)
}

export async function removeSaveSupabase(contestId: string): Promise<void> {
  const uid = await currentUid()
  if (!uid) throw new Error('User not authenticated')

  const { error } = await getSupabase()
    .from('saves')
    .delete()
    .eq('contest_id', contestId)
    .eq('user_id', uid)

  if (error) throw error
}

/**
 * Save a contest and auto-upvote it if not already upvoted. Not a DB
 * transaction (saves/upvotes are independent, idempotent rows); a failed
 * auto-upvote is reported as a non-fatal warning, mirroring the Appwrite path.
 */
export async function saveWithAutoUpvoteSupabase(
  contestId: string,
): Promise<SaveWithAutoUpvoteResult> {
  const uid = await currentUid()
  if (!uid) throw new Error('User not authenticated')

  const { error: saveError } = await getSupabase()
    .from('saves')
    .upsert(
      { contest_id: contestId, user_id: uid },
      { onConflict: 'contest_id,user_id', ignoreDuplicates: true },
    )

  if (saveError) throw saveError

  const alreadyUpvoted = await checkUserUpvoteSupabase(contestId)
  if (alreadyUpvoted) return { success: true, autoUpvoted: false }

  try {
    await createUpvoteSupabase(contestId)
    return { success: true, autoUpvoted: true }
  } catch {
    return { success: true, autoUpvoted: false, warning: 'auto-upvote failed' }
  }
}

/**
 * The user's saved contests (list shape) with a `savedAt` timestamp, most
 * recent first. Mirrors the Appwrite getUserSavedContests contract.
 */
export async function getUserSavedContestsSupabase(
  options: { limit?: number; offset?: number } = {},
): Promise<any[]> {
  const { limit = 20, offset = 0 } = options
  const uid = await currentUid()
  if (!uid) return []

  const { data, error } = await getSupabase()
    .from('saves')
    .select('contest_id, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  const rows = (data ?? []) as { contest_id: string; created_at: string }[]
  if (rows.length === 0) return []

  const savedAtById = new Map(rows.map((r) => [r.contest_id, r.created_at]))
  const ids = rows.map((r) => r.contest_id)
  const contests = await fetchContestsByIdsSupabase(ids)
  const byId = new Map(contests.map((c) => [c.$id, c]))

  // Preserve save order (most recent first) and attach savedAt.
  return ids
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({ ...c, savedAt: savedAtById.get(c.$id) }))
}
