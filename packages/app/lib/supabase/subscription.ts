import { getSupabase } from './client'

export type SupabaseSubscriptionTier = 'free' | 'plus' | 'pro'
export type SupabaseSubscriptionSource = 'none' | 'money' | 'points'

/**
 * Row shape from public.subscriptions (self-readable via RLS). This is the same
 * tier the receipts Edge Function enforces server-side, so reading it here keeps
 * the client's limit UI in agreement with the server.
 */
export interface SupabaseSubscription {
  tier: SupabaseSubscriptionTier
  source: SupabaseSubscriptionSource
  expiresAt: string | null
  autoRenew: boolean
  autoRenewNextTier: 'plus' | 'pro' | null
  autoRenewFailedAt: string | null
}

const SUBSCRIPTION_SELECT =
  'tier, source, expires_at, auto_renew, auto_renew_next_tier, auto_renew_failed_at'

/**
 * Read the current user's subscription. Returns null when not signed in or when
 * no row exists yet (treated as the free tier by the caller).
 */
export async function getSupabaseSubscription(): Promise<SupabaseSubscription | null> {
  const supabase = getSupabase()
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id
  if (!uid) return null

  const { data, error } = await supabase
    .from('subscriptions')
    .select(SUBSCRIPTION_SELECT)
    .eq('user_id', uid)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const row = data as Record<string, any>
  return {
    tier: (row.tier as SupabaseSubscriptionTier) ?? 'free',
    source: (row.source as SupabaseSubscriptionSource) ?? 'none',
    expiresAt: row.expires_at ?? null,
    autoRenew: row.auto_renew ?? false,
    autoRenewNextTier: (row.auto_renew_next_tier as 'plus' | 'pro' | null) ?? null,
    autoRenewFailedAt: row.auto_renew_failed_at ?? null,
  }
}
