import { getSupabasePrefs, updateSupabasePrefs } from 'app/lib/supabase/profile'

/**
 * User preferences (colorTheme, textScale, language, theme, …), stored in the
 * `prefs` jsonb column on public.profiles.
 */
export type UserPrefs = Record<string, any>

export async function getUserPrefs(): Promise<UserPrefs> {
  return getSupabasePrefs()
}

/** Shallow-merge `partial` into the stored prefs (other keys are preserved). */
export async function updateUserPrefs(partial: UserPrefs): Promise<void> {
  await updateSupabasePrefs(partial)
}
