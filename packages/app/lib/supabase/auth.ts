import type { User } from '@supabase/supabase-js'
import { getSupabase } from './client'

/**
 * Minimal user surface the app consumes from `useAuth()`. Structurally a subset
 * of Appwrite's `Models.User` (the app reads `$id`, `name`, `email`), so the
 * AuthContext can cast it across without screen changes during the spike.
 */
export interface AppUser {
  $id: string
  email: string
  name: string
  // Account creation timestamp (ISO). Named `$createdAt` to match the
  // Appwrite-compatible envelope the UI already reads (e.g. referral age check).
  $createdAt: string
}

export function mapSupabaseUser(u: User | null | undefined): AppUser | null {
  if (!u) return null
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>
  const name =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    u.email ||
    'User'
  return {
    $id: u.id,
    email: u.email ?? '',
    name,
    $createdAt: u.created_at ?? new Date().toISOString(),
  }
}

export async function getSupabaseUser(): Promise<AppUser | null> {
  const { data } = await getSupabase().auth.getUser()
  return mapSupabaseUser(data.user)
}

/** Admin = a row in user_roles (replaces Appwrite team:admin). */
export async function isSupabaseAdmin(userId: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle()
  if (error) return false
  return Boolean(data)
}

export async function supabaseSignOut(): Promise<void> {
  await getSupabase().auth.signOut()
}
