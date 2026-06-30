import { getSupabase } from './client'

/**
 * Row shape from public.profiles (the 1:1 companion to auth.users created by the
 * on_auth_user_created trigger). `prefs` is the free-form UI-prefs blob that
 * replaces Appwrite's account.getPrefs()/updatePrefs().
 */
export interface SupabaseProfile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  referral_code: string | null
  prefs: Record<string, any>
}

const PROFILE_SELECT = 'id, email, full_name, avatar_url, referral_code, prefs'

async function currentUserId(): Promise<string | null> {
  const { data } = await getSupabase().auth.getUser()
  return data.user?.id ?? null
}

export async function getSupabaseProfile(): Promise<SupabaseProfile | null> {
  const uid = await currentUserId()
  if (!uid) return null

  const { data, error } = await getSupabase()
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', uid)
    .maybeSingle()

  if (error) throw error
  return (data as SupabaseProfile | null) ?? null
}

/** Read the prefs blob (empty object when not signed in / no row yet). */
export async function getSupabasePrefs(): Promise<Record<string, any>> {
  const profile = await getSupabaseProfile()
  return profile?.prefs ?? {}
}

/**
 * Merge `partial` into the prefs blob (read-merge-write so unrelated keys like a
 * cached avatar survive). The row is guaranteed to exist via the signup trigger;
 * RLS (profiles_self_update) restricts the write to the owner.
 */
export async function updateSupabasePrefs(
  partial: Record<string, any>,
): Promise<void> {
  const uid = await currentUserId()
  if (!uid) return

  const current = await getSupabasePrefs()
  const { data, error } = await getSupabase()
    .from('profiles')
    .update({ prefs: { ...current, ...partial } })
    .eq('id', uid)
    .select('id')

  if (error) throw error
  // An UPDATE that matches no row succeeds with 0 rows. That means the signup
  // trigger never created this profile (partial deploy / trigger failure). RLS
  // blocks a client-side INSERT, so we can't self-heal here — surface it instead
  // of silently dropping the preference write.
  if (!data || data.length === 0) {
    throw new Error(
      'Profile row not found; preferences were not saved. Please sign out and back in.',
    )
  }
}

/** Update the display name on both the profile row and the auth user metadata. */
export async function updateSupabaseDisplayName(fullName: string): Promise<void> {
  const uid = await currentUserId()
  if (!uid) return

  const { error: authError } = await getSupabase().auth.updateUser({
    data: { full_name: fullName },
  })
  if (authError) throw authError

  const { error } = await getSupabase()
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', uid)
  if (error) throw error
}
