'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react'
import { functions } from 'app/provider/appwrite/api'
import { ExecutionMethod } from 'app/lib/appwrite-universal'
import { useAuth } from 'app/contexts/AuthContext'
import { BACKEND } from 'app/lib/backend'
import {
  GET_USER_POINTS_FUNCTION_ID,
  INITIALIZE_USER_POINTS_FUNCTION_ID,
  REDEEM_POINTS_FUNCTION_ID,
} from 'app/provider/appwrite/constants'

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

/**
 * Server response from get-user-points function
 */
interface GetUserPointsResponse {
  success: boolean
  needsInitialization?: boolean
  points: {
    balance: number
    lifetimeEarned: number
    lifetimeSpent: number
    canRedeemPlus: boolean
    canRedeemPro: boolean
    pointsToPlus: number
    pointsToPro: number
    completedReferrals?: number
  }
  transactions?: Array<{
    $id: string
    amount: number
    type: PointTransactionType
    source: PointTransactionSource
    description: string
    balance_after: number
    created_at: string
  }>
  transactionCount?: number
  error?: string
}

/**
 * Server response from initialize-user-points function
 */
interface InitializePointsResponse {
  success: boolean
  points: {
    balance: number
    lifetimeEarned: number
    lifetimeSpent: number
  }
  isNewUser: boolean
  signupBonus: number
  message?: string
  error?: string
}

/**
 * Server response from redeem-points-for-subscription function
 */
interface RedeemPointsResponse {
  success: boolean
  redemption?: {
    tier: 'plus' | 'pro'
    pointsSpent: number
    previousBalance: number
    newBalance: number
    expiresAt: string
    daysAdded: number
  }
  message?: string
  error?: string
  details?: {
    required: number
    current: number
    needed: number
  }
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
    async (includeTransactions = true, reset = true) => {
      if (BACKEND !== 'appwrite') {
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
        setError(null)
        return
      }

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
        // console.log('[PointsContext] Fetching points from server...')

        const execution = await functions.createExecution(
          GET_USER_POINTS_FUNCTION_ID,
          JSON.stringify({
            includeTransactions,
            transactionLimit: 10,
            transactionOffset: reset ? 0 : transactionOffsetRef.current,
          }),
          false, // sync
          '/',
          ExecutionMethod.POST,
        )

        const responseBody =
          execution.responseBody || (execution as any).response

        if (!responseBody) {
          throw new Error('Empty response from server')
        }

        const data: GetUserPointsResponse = JSON.parse(responseBody)

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch points')
        }

        // Auto-initialize if user has no points record yet
        if (data.needsInitialization) {
          // console.log(
          //   '[PointsContext] User not initialized, auto-initializing...'
          // )
          await initializePoints()
          return // initializePoints will refresh
        }

        const { points } = data

        setBalance(points.balance)
        setLifetimeEarned(points.lifetimeEarned)
        setLifetimeSpent(points.lifetimeSpent)
        setCompletedReferrals(points.completedReferrals || 0)
        setCanRedeemPlus(points.canRedeemPlus)
        setCanRedeemPro(points.canRedeemPro)
        setPointsToPlus(points.pointsToPlus)
        setPointsToPro(points.pointsToPro)
        setIsInitialized(true)

        if (data.transactions) {
          const parsedTransactions: PointTransaction[] = data.transactions.map(
            (t) => ({
              id: t.$id,
              amount: t.amount,
              type: t.type,
              source: t.source,
              description: t.description,
              balanceAfter: t.balance_after,
              createdAt: new Date(t.created_at),
            }),
          )

          if (reset) {
            setTransactions(parsedTransactions)
            transactionOffsetRef.current = parsedTransactions.length
            setTransactionOffset(parsedTransactions.length)
          } else {
            setTransactions((prev) => [...prev, ...parsedTransactions])
            transactionOffsetRef.current =
              transactionOffsetRef.current + parsedTransactions.length
            setTransactionOffset(transactionOffsetRef.current)
          }
        }

        if (data.transactionCount !== undefined) {
          setTransactionCount(data.transactionCount)
        }

        // console.log(
        //   `[PointsContext] Balance: ${points.balance}, Lifetime: ${points.lifetimeEarned}`
        // )
      } catch (err) {
        // console.error('[PointsContext] Failed to fetch points:', err)
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
    if (BACKEND !== 'appwrite') {
      return { success: false }
    }

    if (!user) {
      return { success: false }
    }

    try {
      console.log('[PointsContext] Initializing points...')

      const execution = await functions.createExecution(
        INITIALIZE_USER_POINTS_FUNCTION_ID,
        JSON.stringify({}),
        false, // sync
        '/',
        ExecutionMethod.POST,
      )

      const responseBody = execution.responseBody || (execution as any).response

      if (!responseBody) {
        throw new Error('Empty response from server')
      }

      const data: InitializePointsResponse = JSON.parse(responseBody)

      if (!data.success) {
        throw new Error(data.error || 'Failed to initialize points')
      }

      // Refresh points to get latest state
      await refreshPoints(true, true)

      return {
        success: true,
        bonus: data.isNewUser ? data.signupBonus : 0,
      }
    } catch (err) {
      console.error('[PointsContext] Failed to initialize points:', err)
      return { success: false }
    }
  }, [user, refreshPoints])

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
      if (BACKEND !== 'appwrite') {
        return { success: false, error: 'Points are not migrated yet' }
      }

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
        console.log(`[PointsContext] Redeeming ${cost} points for ${tier}...`)
        setIsRedeeming(true)

        const execution = await functions.createExecution(
          REDEEM_POINTS_FUNCTION_ID,
          JSON.stringify({ tier }),
          false, // sync
          '/',
          ExecutionMethod.POST,
        )

        const responseBody =
          execution.responseBody || (execution as any).response

        if (!responseBody) {
          throw new Error('Empty response from server')
        }

        const data: RedeemPointsResponse = JSON.parse(responseBody)

        if (!data.success) {
          return {
            success: false,
            error: data.error || 'Failed to redeem points',
          }
        }

        // Refresh points to get updated balance
        await refreshPoints(true, true)

        return {
          success: true,
          message: data.message,
          expiresAt: data.redemption?.expiresAt
            ? new Date(data.redemption.expiresAt)
            : undefined,
        }
      } catch (err) {
        console.error('[PointsContext] Failed to redeem points:', err)
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
