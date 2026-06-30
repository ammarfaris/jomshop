import { BACKEND } from 'app/lib/backend'
import { account } from 'app/provider/appwrite/api'
import { getSupabasePrefs, updateSupabasePrefs } from 'app/lib/supabase/profile'

/**
 * Backend-agnostic user preferences (colorTheme, textScale, language, theme, …).
 *
 *  - Appwrite : account.getPrefs() / updatePrefs() (free-form key-value).
 *  - Supabase : the `prefs` jsonb column on public.profiles.
 *
 * Lets feature code persist prefs without caring which backend is active, so the
 * cutover is a single flag flip.
 */
export type UserPrefs = Record<string, any>

export async function getUserPrefs(): Promise<UserPrefs> {
  if (BACKEND === 'supabase') return getSupabasePrefs()
  return (await account.getPrefs()) as UserPrefs
}

/** Shallow-merge `partial` into the stored prefs (other keys are preserved). */
export async function updateUserPrefs(partial: UserPrefs): Promise<void> {
  if (BACKEND === 'supabase') {
    await updateSupabasePrefs(partial)
    return
  }
  const current = await account.getPrefs()
  await account.updatePrefs({ ...current, ...partial })
}
