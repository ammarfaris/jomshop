import { getSupabase } from './client'

// Points needed to redeem each tier. MUST stay in sync with REDEMPTION_COSTS in
// PointsContext and the redeem RPC (server-side source of truth).
export const REDEEM_PLUS_COST = 1500
export const REDEEM_PRO_COST = 3000

export interface SupabasePointTransaction {
  id: string
  amount: number
  type: 'earn' | 'spend'
  source: string
  description: string
  balanceAfter: number
  createdAt: string
}

export interface SupabasePoints {
  balance: number
  lifetimeEarned: number
  lifetimeSpent: number
  completedReferrals: number
  canRedeemPlus: boolean
  canRedeemPro: boolean
  pointsToPlus: number
  pointsToPro: number
  transactions: SupabasePointTransaction[]
  transactionCount: number
}

async function currentUid(): Promise<string | null> {
  const { data } = await getSupabase().auth.getUser()
  return data.user?.id ?? null
}

/**
 * Read the current user's points snapshot + a page of ledger transactions.
 * Pure RLS reads (points_accounts / points_ledger are self-readable) — no Edge
 * Function needed. Returns null when signed out; a never-initialized account
 * reads as a zero balance.
 */
export async function getSupabasePoints(
  transactionLimit = 10,
  transactionOffset = 0,
): Promise<SupabasePoints | null> {
  const supabase = getSupabase()
  const uid = await currentUid()
  if (!uid) return null

  const { data: account, error: accErr } = await supabase
    .from('points_accounts')
    .select(
      'balance, lifetime_earned, lifetime_spent, completed_referrals_count',
    )
    .eq('user_id', uid)
    .maybeSingle()
  if (accErr) throw accErr

  const balance = (account?.balance as number) ?? 0
  const lifetimeEarned = (account?.lifetime_earned as number) ?? 0
  const lifetimeSpent = (account?.lifetime_spent as number) ?? 0
  const completedReferrals =
    (account?.completed_referrals_count as number) ?? 0

  const {
    data: rows,
    count,
    error: txErr,
  } = await supabase
    .from('points_ledger')
    .select(
      'id, amount, type, source, description, balance_after, created_at',
      { count: 'exact' },
    )
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .range(transactionOffset, transactionOffset + transactionLimit - 1)
  if (txErr) throw txErr

  const transactions: SupabasePointTransaction[] = (rows ?? []).map(
    (r: Record<string, any>) => ({
      id: r.id,
      amount: r.amount,
      type: r.type,
      source: r.source,
      description: r.description,
      balanceAfter: r.balance_after ?? 0,
      createdAt: r.created_at,
    }),
  )

  return {
    balance,
    lifetimeEarned,
    lifetimeSpent,
    completedReferrals,
    canRedeemPlus: balance >= REDEEM_PLUS_COST,
    canRedeemPro: balance >= REDEEM_PRO_COST,
    pointsToPlus: Math.max(REDEEM_PLUS_COST - balance, 0),
    pointsToPro: Math.max(REDEEM_PRO_COST - balance, 0),
    transactions,
    transactionCount: count ?? 0,
  }
}

export interface RedeemPointsResult {
  success: boolean
  error?: string
  expiresAt?: string
  daysAdded?: number
  newBalance?: number
}

/**
 * Spend points for a subscription via the redeem RPC (atomic, server-enforced
 * balance + tier costs). The RPC returns `{ success, redemption | error }`.
 */
export async function redeemPointsSupabase(
  tier: 'plus' | 'pro',
): Promise<RedeemPointsResult> {
  const { data, error } = await getSupabase().rpc(
    'redeem_points_for_subscription',
    { p_tier: tier },
  )
  if (error) return { success: false, error: error.message }

  const res = data as {
    success: boolean
    error?: string
    redemption?: { expiresAt?: string; daysAdded?: number; newBalance?: number }
  }
  if (!res?.success) {
    return { success: false, error: res?.error || 'Failed to redeem points' }
  }
  return {
    success: true,
    expiresAt: res.redemption?.expiresAt,
    daysAdded: res.redemption?.daysAdded,
    newBalance: res.redemption?.newBalance,
  }
}

/**
 * Admin-only manual points grant/deduction (positive earns, negative spends).
 * Authorization is enforced inside the RPC via is_admin().
 */
export async function adminAdjustPointsSupabase(
  userId: string,
  amount: number,
  description: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const { data, error } = await getSupabase().rpc('admin_adjust_points', {
    p_user: userId,
    p_amount: amount,
    p_description: description,
    p_metadata: metadata ?? null,
  })
  if (error) throw new Error(error.message)
  const res = data as { success: boolean; error?: string }
  if (!res?.success) throw new Error(res?.error || 'Failed to adjust points')
}
