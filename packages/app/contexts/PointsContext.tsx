'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react'
import { useAuth } from 'app/contexts/AuthContext'
import {
  getSupabasePoints,
  redeemPointsSupabase,
} from 'app/lib/supabase/points'

/**
 * Point transaction types
 */
export type PointTransactionType = 'earn' | 'spend'

/**
 * Point transaction sources
 */
export type PointTransactionSource =
  | 'signup'
  | 'referral'
  | 'affiliate'
  | 'receipt'
  | 'subscription'
  | 'purchase'
  | 'admin'
  | 'bonus'

/**
 * Point transaction record
 */
export interface PointTransaction {
  id: string
  amount: number
  type: PointTransactionType
  source: PointTransactionSource
  description: string
  balanceAfter: number
  createdAt: Date
}

/**
 * Points data from server
 */
export interface PointsData {
  balance: number
  lifetimeEarned: number
  lifetimeSpent: number
  canRedeemPlus: boolean
  canRedeemPro: boolean
  pointsToPlus: number
  pointsToPro: number
  completedReferrals: number
}

// Costs for redemption
export const REDEMPTION_COSTS = {
  plus: 1500,
  pro: 3000,
} as const

interface PointsContextType {
  // Points data
  balance: number
  lifetimeEarned: number
  lifetimeSpent: number
  completedReferrals: number

  // Redemption status
  canRedeemPlus: boolean
  canRedeemPro: boolean
  pointsToPlus: number
  pointsToPro: number

  // Transactions
  transactions: PointTransaction[]
  transactionCount: number

  // State
  isLoading: boolean
  isRedeeming: boolean
  isInitialized: boolean
  error: string | null

  // Actions
  refreshPoints: () => Promise<void>
  loadMoreTransactions: () => Promise<void>
  initializePoints: () => Promise<{ success: boolean; bonus?: number }>
  redeemForSubscription: (tier: 'plus' | 'pro') => Promise<{
    success: boolean
    message?: string
    error?: string
    expiresAt?: Date
  }>
}

const PointsContext = createContext<PointsContextType>({
  balance: 0,
  lifetimeEarned: 0,
  lifetimeSpent: 0,
  completedReferrals: 0,
  canRedeemPlus: false,
  canRedeemPro: false,
  pointsToPlus: REDEMPTION_COSTS.plus,
  pointsToPro: REDEMPTION_COSTS.pro,
  transactions: [],
  transactionCount: 0,
  isLoading: true,
  isRedeeming: false,
  isInitialized: false,
  error: null,
  refreshPoints: async () => {},
  loadMoreTransactions: async () => {},
  initializePoints: async () => ({ success: false }),
  redeemForSubscription: async () => ({ success: false }),
})

export function PointsProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState(0)
  const [lifetimeEarned, setLifetimeEarned] = useState(0)
  const [lifetimeSpent, setLifetimeSpent] = useState(0)
  const [completedReferrals, setCompletedReferrals] = useState(0)
  const [canRedeemPlus, setCanRedeemPlus] = useState(false)
  const [canRedeemPro, setCanRedeemPro] = useState(false)
  const [pointsToPlus, setPointsToPlus] = useState<number>(
    REDEMPTION_COSTS.plus,
  )
  const [pointsToPro, setPointsToPro] = useState<number>(REDEMPTION_COSTS.pro)
  const [transactions, setTransactions] = useState<PointTransaction[]>([])
  const [transactionCount, setTransactionCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transactionOffset, setTransactionOffset] = useState(0)
  const transactionOffsetRef = useRef(0)
  const isLoadingMoreRef = useRef(false)

  const { user, isLoading: isAuthLoading } = useAuth()

  /**
   * Fetch points from server
   */
  const refreshPoints = useCallback(
    async (_includeTransactions = true, reset = true) => {
      if (!user) {
        setBalance(0)
        setLifetimeEarned(0)
        setLifetimeSpent(0)
        setCompletedReferrals(0)
        setCanRedeemPlus(false)
        setCanRedeemPro(false)
        setPointsToPlus(REDEMPTION_COSTS.plus)
        setPointsToPro(REDEMPTION_COSTS.pro)
        setTransactions([])
        setTransactionCount(0)
        setIsLoading(false)
        setIsInitialized(false)
        return
      }
      try {
        setError(null)
        const data = await getSupabasePoints(
          10,
          reset ? 0 : transactionOffsetRef.current,
        )
        if (!data) {
          setIsLoading(false)
          setIsInitialized(false)
          return
        }
        setBalance(data.balance)
        setLifetimeEarned(data.lifetimeEarned)
        setLifetimeSpent(data.lifetimeSpent)
        setCompletedReferrals(data.completedReferrals)
        setCanRedeemPlus(data.canRedeemPlus)
        setCanRedeemPro(data.canRedeemPro)
        setPointsToPlus(data.pointsToPlus)
        setPointsToPro(data.pointsToPro)
        setIsInitialized(true)

        const parsed: PointTransaction[] = data.transactions.map((tx) => ({
          id: tx.id,
          amount: tx.amount,
          type: tx.type,
          source: tx.source as PointTransactionSource,
          description: tx.description,
          balanceAfter: tx.balanceAfter,
          createdAt: new Date(tx.createdAt),
        }))
        if (reset) {
          setTransactions(parsed)
          transactionOffsetRef.current = parsed.length
          setTransactionOffset(parsed.length)
        } else {
          setTransactions((prev) => [...prev, ...parsed])
          transactionOffsetRef.current += parsed.length
          setTransactionOffset(transactionOffsetRef.current)
        }
        setTransactionCount(data.transactionCount)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch points')
      } finally {
        setIsLoading(false)
      }
    },
    [user],
  )

  /**
   * Load more transactions (pagination)
   */
  const loadMoreTransactions = useCallback(async () => {
    if (!user) return
    // Guard against reentrant calls: ref is updated synchronously after a
    // fetch completes, while state lags by a render. Without this, rapid
    // calls (e.g. FlatList onEndReached firing twice) would slip past the
    // offset check and trigger duplicate requests with stale offsets.
    if (isLoadingMoreRef.current) return
    if (transactionOffsetRef.current >= transactionCount) return

    isLoadingMoreRef.current = true
    try {
      await refreshPoints(true, false)
    } finally {
      isLoadingMoreRef.current = false
    }
  }, [user, transactionCount, refreshPoints])

  /**
   * Initialize points for new user (grants signup bonus)
   */
  const initializePoints = useCallback(async (): Promise<{
    success: boolean
    bonus?: number
  }> => {
    // Supabase grants the signup bonus via a DB trigger, so there's nothing to
    // initialize client-side.
    return { success: true }
  }, [])

  /**
   * Redeem points for subscription
   */
  const redeemForSubscription = useCallback(
    async (
      tier: 'plus' | 'pro',
    ): Promise<{
      success: boolean
      message?: string
      error?: string
      expiresAt?: Date
    }> => {
      if (!user) {
        return { success: false, error: 'Not authenticated' }
      }
      const cost = REDEMPTION_COSTS[tier]
      if (balance < cost) {
        return {
          success: false,
          error: `Insufficient points. You need ${cost - balance} more points.`,
        }
      }
      try {
        setIsRedeeming(true)
        const res = await redeemPointsSupabase(tier)
        if (!res.success) {
          return { success: false, error: res.error || 'Failed to redeem points' }
        }
        await refreshPoints(true, true)
        return {
          success: true,
          message: 'Subscription activated with points',
          expiresAt: res.expiresAt ? new Date(res.expiresAt) : undefined,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to redeem points',
        }
      } finally {
        setIsRedeeming(false)
      }
    },
    [user, balance, refreshPoints],
  )

  // Stable public refresh callback. Without useCallback this is a new function
  // on every render, which makes consumer effects with `refreshPoints` in their
  // dependency array (e.g. ProfileScreen) re-run every render — and because the
  // unconfigured/Supabase branch calls setTransactions([]) (a fresh array ref)
  // that re-render is guaranteed, producing an infinite update loop.
  const refreshPointsPublic = useCallback(
    () => refreshPoints(true, true),
    [refreshPoints],
  )

  // Load points when user changes
  useEffect(() => {
    if (isAuthLoading) return

    if (!user) {
      setBalance(0)
      setLifetimeEarned(0)
      setLifetimeSpent(0)
      setCompletedReferrals(0)
      setCanRedeemPlus(false)
      setCanRedeemPro(false)
      setPointsToPlus(REDEMPTION_COSTS.plus)
      setPointsToPro(REDEMPTION_COSTS.pro)
      setTransactions([])
      setTransactionCount(0)
      transactionOffsetRef.current = 0
      setTransactionOffset(0)
      isLoadingMoreRef.current = false
      setIsLoading(false)
      setIsInitialized(false)
      return
    }

    refreshPoints(true, true)
  }, [user, isAuthLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const value: PointsContextType = {
    balance,
    lifetimeEarned,
    lifetimeSpent,
    completedReferrals,
    canRedeemPlus,
    canRedeemPro,
    pointsToPlus,
    pointsToPro,
    transactions,
    transactionCount,
    isLoading,
    isRedeeming,
    isInitialized,
    error,
    refreshPoints: refreshPointsPublic,
    loadMoreTransactions,
    initializePoints,
    redeemForSubscription,
  }

  return (
    <PointsContext.Provider value={value}>{children}</PointsContext.Provider>
  )
}

export const usePoints = () => useContext(PointsContext)
