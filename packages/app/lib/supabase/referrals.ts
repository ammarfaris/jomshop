import { getSupabase } from './client'

/** Mirrors the Appwrite-flavored ReferralRecord the ReferralCard already renders. */
export interface SupabaseReferralRecord {
  $id: string
  $createdAt: string
  referrer_user_id: string
  referee_user_id: string
  referral_code: string
  status: 'pending' | 'completed' | 'limit_reached'
  points_awarded: number
  completed_at?: string
  referee_fullname?: string
  referee_email?: string
  referrer_fullname?: string
  referrer_email?: string
}

export interface SupabaseReferralSettings {
  maxReferrals: number
  notes: string | null
}

const REFERRAL_SELECT =
  'id, created_at, referrer_user_id, referee_user_id, referral_code, status, ' +
  'points_awarded, completed_at, referee_fullname, referee_email, ' +
  'referrer_fullname, referrer_email'

function mapRow(r: Record<string, any>): SupabaseReferralRecord {
  return {
    $id: r.id,
    $createdAt: r.created_at,
    referrer_user_id: r.referrer_user_id,
    referee_user_id: r.referee_user_id,
    referral_code: r.referral_code,
    status: r.status,
    points_awarded: r.points_awarded ?? 0,
    completed_at: r.completed_at ?? undefined,
    referee_fullname: r.referee_fullname ?? undefined,
    referee_email: r.referee_email ?? undefined,
    referrer_fullname: r.referrer_fullname ?? undefined,
    referrer_email: r.referrer_email ?? undefined,
  }
}

async function currentUid(): Promise<string | null> {
  const { data } = await getSupabase().auth.getUser()
  return data.user?.id ?? null
}

/** Referrals this user has made (as referrer), newest first. */
export async function getSupabaseReferralHistory(): Promise<
  SupabaseReferralRecord[]
> {
  const uid = await currentUid()
  if (!uid) return []
  const { data, error } = await getSupabase()
    .from('referrals')
    .select(REFERRAL_SELECT)
    .eq('referrer_user_id', uid)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []).map(mapRow)
}

/** The single referral where this user is the referee (if they were referred). */
export async function getSupabaseMyReferral(): Promise<SupabaseReferralRecord | null> {
  const uid = await currentUid()
  if (!uid) return null
  const { data, error } = await getSupabase()
    .from('referrals')
    .select(REFERRAL_SELECT)
    .eq('referee_user_id', uid)
    .maybeSingle()
  if (error) throw error
  return data ? mapRow(data) : null
}

/** Per-user referral cap override (admin-managed). Falls back to the default. */
export async function getSupabaseReferralSettings(): Promise<SupabaseReferralSettings> {
  const uid = await currentUid()
  if (!uid) return { maxReferrals: 10, notes: null }
  const { data, error } = await getSupabase()
    .from('referral_settings')
    .select('max_referrals, notes')
    .eq('user_id', uid)
    .maybeSingle()
  // Permission/empty -> default of 10 (mirrors the Appwrite fallback).
  if (error) return { maxReferrals: 10, notes: null }
  return {
    maxReferrals: (data?.max_referrals as number) ?? 10,
    notes: (data?.notes as string) ?? null,
  }
}

/**
 * Redeem a referral code (the referrer's user id). Creates a pending referral;
 * the 200-point bonus is paid on the referee's first receipt. Throws with the
 * server-provided message on failure (self-referral, already-redeemed, etc.).
 */
export async function redeemReferralCodeSupabase(code: string): Promise<void> {
  const { data, error } = await getSupabase().rpc('redeem_referral_code', {
    p_code: code,
  })
  if (error) throw new Error(error.message)
  const res = data as { success: boolean; error?: string }
  if (!res?.success) throw new Error(res?.error || 'Failed to redeem code')
}

// --------------------------------------------------------------------------
// Admin: per-user referral cap management (RLS gates writes to admins).
// --------------------------------------------------------------------------

/** Appwrite-flavored row the admin ReferralManager renders. */
export interface SupabaseReferralSettingRow {
  $id: string
  $createdAt: string
  $updatedAt: string
  user_id: string
  max_referrals: number
  notes?: string
  modified_by?: string
  previous_limit?: number
}

export async function listSupabaseReferralSettings(): Promise<
  SupabaseReferralSettingRow[]
> {
  const { data, error } = await getSupabase()
    .from('referral_settings')
    .select('user_id, max_referrals, notes, modified_by, previous_limit, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []).map((r: Record<string, any>) => ({
    // referral_settings has no created_at; updated_at stands in for both.
    $id: r.user_id,
    $createdAt: r.updated_at,
    $updatedAt: r.updated_at,
    user_id: r.user_id,
    max_referrals: r.max_referrals,
    notes: r.notes ?? undefined,
    modified_by: r.modified_by ?? undefined,
    previous_limit: r.previous_limit ?? undefined,
  }))
}

export async function upsertSupabaseReferralSetting(params: {
  userId: string
  maxReferrals: number
  notes: string | null
  modifiedBy?: string
  previousLimit: number
}): Promise<void> {
  const { error } = await getSupabase()
    .from('referral_settings')
    .upsert(
      {
        user_id: params.userId,
        max_referrals: params.maxReferrals,
        notes: params.notes,
        modified_by: params.modifiedBy ?? null,
        previous_limit: params.previousLimit,
      },
      { onConflict: 'user_id' },
    )
  if (error) throw error
}

export async function deleteSupabaseReferralSetting(
  userId: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from('referral_settings')
    .delete()
    .eq('user_id', userId)
  if (error) throw error
}

/** Count a referrer's completed referrals (admin view of any user). */
export async function getSupabaseCompletedReferralCount(
  referrerUserId: string,
): Promise<number> {
  const { count, error } = await getSupabase()
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_user_id', referrerUserId)
    .eq('status', 'completed')
  if (error) return 0
  return count ?? 0
}
