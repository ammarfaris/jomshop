/**
 * Backend selector for the Appwrite -> Supabase migration (strangler pattern).
 *
 * Default is 'appwrite' so nothing changes until a build explicitly opts in via
 *   EXPO_PUBLIC_BACKEND=supabase   (native / expo)
 *   NEXT_PUBLIC_BACKEND=supabase   (web / next)
 */
export type Backend = 'appwrite' | 'supabase'

const raw =
  process.env.EXPO_PUBLIC_BACKEND ||
  process.env.NEXT_PUBLIC_BACKEND ||
  'appwrite'

export const BACKEND: Backend = raw === 'supabase' ? 'supabase' : 'appwrite'

export const isSupabaseBackend = BACKEND === 'supabase'
