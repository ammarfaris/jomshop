'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'
import { functions } from 'app/provider/appwrite/api'
import { ExecutionMethod } from 'app/lib/appwrite-universal'
import { useAuth } from 'app/contexts/AuthContext'
import { GET_SUBSCRIPTION_TIER_FUNCTION_ID } from 'app/provider/appwrite/constants'
import { BACKEND } from 'app/lib/backend'

/**
 * Subscription Tier Types
 * - free: Default tier, limited features
 * - plus: Mid tier, most features unlocked
 * - pro: Premium tier, all features unlocked
 */
export type SubscriptionTier = 'free' | 'plus' | 'pro'

/**
 * Subscription source - how the user got their subscription
 * - none: Free tier (no subscription)
 * - money: Paid via RevenueCat (card/Apple Pay/Google Pay)
 * - points: Redeemed using points
 */
export type SubscriptionSource = 'none' | 'money' | 'points'

/**
 * Feature flags for each subscription tier
 * This makes it easy to check what features are available
 */
export interface SubscriptionFeatures {
  canChangeColorTheme: boolean
  canChangeTextScale: boolean
  maxContestsWithReceipts: number // -1 for unlimited
  maxReceiptsPerContest: number // -1 for unlimited
  hasReducedAds: boolean
  hasNoAds: boolean
  hasPrioritySupport: boolean
}

const TIER_FEATURES: Record<SubscriptionTier, SubscriptionFeatures> = {
  free: {
    canChangeColorTheme: false,
    canChangeTextScale: true,
    maxContestsWithReceipts: 5,
    maxReceiptsPerContest: 3,
    hasReducedAds: false,
    hasNoAds: false,
    hasPrioritySupport: false,
  },
  plus: {
    canChangeColorTheme: true,
    canChangeTextScale: true,
    maxContestsWithReceipts: -1, // unlimited
    maxReceiptsPerContest: 10,
    hasReducedAds: true,
    hasNoAds: false,
    hasPrioritySupport: false,
  },
  pro: {
    canChangeColorTheme: true,
    canChangeTextScale: true,
    maxContestsWithReceipts: -1, // unlimited
    maxReceiptsPerContest: -1, // unlimited
    hasReducedAds: true,
    hasNoAds: true,
    hasPrioritySupport: true,
  },
}

/**
 * Server response from get-subscription-tier function
 */
interface SubscriptionTierResponse {
  success: boolean
  subscription: {
    tier: SubscriptionTier
    source: SubscriptionSource
    expiresAt: string | null
    isActive: boolean
    daysRemaining: number | null
    autoRenew: boolean
    autoRenewNextTier: SubscriptionTier | null
    autoRenewFailedAt: string | null
    autoRenewFailedDismissed: boolean
    autoRenewAdjustedAt: string | null
    autoRenewAdjustedDismissed: boolean
  }
  limits: SubscriptionFeatures
  expiringSoon: boolean
  error?: string
}

interface SubscriptionContextType {
  tier: SubscriptionTier
  source: SubscriptionSource
  features: SubscriptionFeatures
  isLoading: boolean
  isPremium: boolean // true if plus or pro
  expiresAt: Date | null
  daysRemaining: number | null
  expiringSoon: boolean // true if expiring within 7 days
  autoRenew: boolean // true if auto-renew with points is enabled
  autoRenewNextTier: SubscriptionTier | null // which tier to renew into (points auto-renew)
  autoRenewFailedAt: Date | null // timestamp when auto-renew completely failed (insufficient points for any tier)
  autoRenewFailedDismissed: boolean // whether user dismissed the failure alert
  autoRenewAdjustedAt: Date | null // timestamp when auto-renew succeeded but at a lower tier
  autoRenewAdjustedDismissed: boolean // whether user dismissed the adjusted alert
  isUpdatingAutoRenew: boolean
  // Refresh subscription from server
  refreshSubscription: () => Promise<void>
  // Update auto-renew preference
  updateAutoRenew: (enabled: boolean) => Promise<boolean>
  // Update auto-renew tier preference (plus/pro)
  updateAutoRenewNextTier: (tier: 'plus' | 'pro') => Promise<boolean>
  // Dismiss auto-renew failed alert (after user acknowledges)
  dismissAutoRenewFailed: () => Promise<void>
  // Dismiss auto-renew adjusted alert (after user acknowledges)
  dismissAutoRenewAdjusted: () => Promise<void>
  // Check if a specific feature is available
  hasFeature: (feature: keyof SubscriptionFeatures) => boolean
  // Get tier display info
  getTierDisplayName: () => string
  getTierEmoji: () => string
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  tier: 'free',
  source: 'none',
  features: TIER_FEATURES.free,
  isLoading: true,
  isPremium: false,
  expiresAt: null,
  daysRemaining: null,
  expiringSoon: false,
  autoRenew: false,
  autoRenewNextTier: null,
  autoRenewFailedAt: null,
  autoRenewFailedDismissed: false,
  autoRenewAdjustedAt: null,
  autoRenewAdjustedDismissed: false,
  isUpdatingAutoRenew: false,
  refreshSubscription: async () => {},
  updateAutoRenew: async () => false,
  updateAutoRenewNextTier: async () => false,
  dismissAutoRenewFailed: async () => {},
  dismissAutoRenewAdjusted: async () => {},
  hasFeature: () => false,
  getTierDisplayName: () => 'Free',
  getTierEmoji: () => '🆓',
})

export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [tier, setTier] = useState<SubscriptionTier>('free')
  const [source, setSource] = useState<SubscriptionSource>('none')
  const [features, setFeatures] = useState<SubscriptionFeatures>(
    TIER_FEATURES.free
  )
  const [isLoading, setIsLoading] = useState(true)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null)
  const [expiringSoon, setExpiringSoon] = useState(false)
  const [autoRenew, setAutoRenew] = useState(false)
  const [autoRenewNextTier, setAutoRenewNextTier] =
    useState<SubscriptionTier | null>(null)
  const [autoRenewFailedAt, setAutoRenewFailedAt] = useState<Date | null>(null)
  const [autoRenewFailedDismissed, setAutoRenewFailedDismissed] =
    useState(false)
  const [autoRenewAdjustedAt, setAutoRenewAdjustedAt] = useState<Date | null>(
    null
  )
  const [autoRenewAdjustedDismissed, setAutoRenewAdjustedDismissed] =
    useState(false)
  const [isUpdatingAutoRenew, setIsUpdatingAutoRenew] = useState(false)
  const { user, isLoading: isAuthLoading } = useAuth()

  /**
   * Fetch subscription tier from server
   * This is the ONLY source of truth for subscription status
   */
  const refreshSubscription = useCallback(async () => {
    if (BACKEND !== 'appwrite') {
      setTier('free')
      setSource('none')
      setFeatures(TIER_FEATURES.free)
      setExpiresAt(null)
      setDaysRemaining(null)
      setExpiringSoon(false)
      setAutoRenew(false)
      setAutoRenewFailedAt(null)
      setAutoRenewFailedDismissed(false)
      setAutoRenewAdjustedAt(null)
      setAutoRenewAdjustedDismissed(false)
      setIsLoading(false)
      return
    }

    if (!user) {
      setTier('free')
      setSource('none')
      setFeatures(TIER_FEATURES.free)
      setExpiresAt(null)
      setDaysRemaining(null)
      setExpiringSoon(false)
      setAutoRenew(false)
      setAutoRenewFailedAt(null)
      setAutoRenewFailedDismissed(false)
      setAutoRenewAdjustedAt(null)
      setAutoRenewAdjustedDismissed(false)
      setIsLoading(false)
      return
    }

    try {
      // console.log('[SubscriptionContext] Fetching subscription from server...')

      const execution = await functions.createExecution(
        GET_SUBSCRIPTION_TIER_FUNCTION_ID,
        JSON.stringify({}),
        false, // sync
        '/',
        ExecutionMethod.POST
      )

      const responseBody = execution.responseBody || (execution as any).response

      if (!responseBody) {
        throw new Error('Empty response from server')
      }

      const data: SubscriptionTierResponse = JSON.parse(responseBody)

      // console.log('[SubscriptionContext] Raw response:', data)

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch subscription')
      }

      const { subscription, limits, expiringSoon: expiring } = data

      setTier(subscription.tier)
      setSource(subscription.source)
      setFeatures(limits)
      setExpiresAt(
        subscription.expiresAt ? new Date(subscription.expiresAt) : null
      )
      setDaysRemaining(subscription.daysRemaining)
      setExpiringSoon(expiring)
      setAutoRenew(subscription.autoRenew || false)
      setAutoRenewNextTier(
        subscription.autoRenewNextTier ||
          (subscription.tier === 'plus' || subscription.tier === 'pro'
            ? subscription.tier
            : null)
      )
      setAutoRenewFailedAt(
        subscription.autoRenewFailedAt
          ? new Date(subscription.autoRenewFailedAt)
          : null
      )
      setAutoRenewFailedDismissed(
        subscription.autoRenewFailedDismissed || false
      )
      setAutoRenewAdjustedAt(
        subscription.autoRenewAdjustedAt
          ? new Date(subscription.autoRenewAdjustedAt)
          : null
      )
      setAutoRenewAdjustedDismissed(
        subscription.autoRenewAdjustedDismissed || false
      )

      // console.log(
      //   `[SubscriptionContext] Tier: ${subscription.tier}, Source: ${subscription.source}, Expires: ${subscription.expiresAt}`
      // )
    } catch (error) {
      console.error(
        '[SubscriptionContext] Failed to fetch subscription:',
        error
      )
      // Default to free on error
      setTier('free')
      setSource('none')
      setFeatures(TIER_FEATURES.free)
      setExpiresAt(null)
      setDaysRemaining(null)
      setExpiringSoon(false)
      setAutoRenew(false)
      setAutoRenewNextTier(null)
      setAutoRenewFailedAt(null)
      setAutoRenewFailedDismissed(false)
      setAutoRenewAdjustedAt(null)
      setAutoRenewAdjustedDismissed(false)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  // Load subscription when user changes
  useEffect(() => {
    if (isAuthLoading) return

    if (!user) {
      setTier('free')
      setSource('none')
      setFeatures(TIER_FEATURES.free)
      setExpiresAt(null)
      setDaysRemaining(null)
      setExpiringSoon(false)
      setAutoRenew(false)
      setAutoRenewNextTier(null)
      setAutoRenewFailedAt(null)
      setAutoRenewFailedDismissed(false)
      setAutoRenewAdjustedAt(null)
      setAutoRenewAdjustedDismissed(false)
      setIsLoading(false)
      return
    }

    refreshSubscription()
  }, [user, isAuthLoading, refreshSubscription])

  const hasFeature = useCallback(
    (feature: keyof SubscriptionFeatures): boolean => {
      const value = features[feature]
      if (typeof value === 'boolean') return value
      if (typeof value === 'number') return value !== 0
      return false
    },
    [features]
  )

  const getTierDisplayName = useCallback((): string => {
    switch (tier) {
      case 'free':
        return 'Free'
      case 'plus':
        return 'Plus'
      case 'pro':
        return 'Pro'
      default:
        return 'Free'
    }
  }, [tier])

  const getTierEmoji = useCallback((): string => {
    switch (tier) {
      case 'free':
        return '🆓'
      case 'plus':
        return '⭐'
      case 'pro':
        return '👑'
      default:
        return '🆓'
    }
  }, [tier])

  /**
   * Dismiss auto-renew failed alert after user acknowledges
   * This sets the dismissed flag on server and locally
   * Preserves the timestamp for auditing purposes
   * Note: Does NOT send autoRenew to avoid unintentionally modifying the preference
   */
  const dismissAutoRenewFailed = useCallback(async () => {
    if (!user) return

    try {
      const execution = await functions.createExecution(
        'fn_update-auto-renew',
        JSON.stringify({ dismissType: 'failed' }),
        false,
        '/',
        ExecutionMethod.POST
      )

      const responseBody = execution.responseBody || (execution as any).response

      if (!responseBody) {
        throw new Error('Empty response from server')
      }

      const data = JSON.parse(responseBody)

      if (!data.success) {
        throw new Error(
          data.error || 'Failed to dismiss auto-renew failed alert'
        )
      }

      // Only update the failed dismissed flag
      setAutoRenewFailedDismissed(true)
    } catch (error) {
      console.error(
        '[SubscriptionContext] Failed to dismiss auto-renew failed alert:',
        error
      )
    }
  }, [user])

  /**
   * Dismiss auto-renew adjusted alert after user acknowledges
   * This sets the dismissed flag on server and locally
   * Preserves the timestamp for auditing purposes
   * Note: Does NOT send autoRenew to avoid unintentionally modifying the preference
   */
  const dismissAutoRenewAdjusted = useCallback(async () => {
    if (!user) return

    try {
      const execution = await functions.createExecution(
        'fn_update-auto-renew',
        JSON.stringify({ dismissType: 'adjusted' }),
        false,
        '/',
        ExecutionMethod.POST
      )

      const responseBody = execution.responseBody || (execution as any).response

      if (!responseBody) {
        throw new Error('Empty response from server')
      }

      const data = JSON.parse(responseBody)

      if (!data.success) {
        throw new Error(
          data.error || 'Failed to dismiss auto-renew adjusted alert'
        )
      }

      // Only update the adjusted dismissed flag
      setAutoRenewAdjustedDismissed(true)
    } catch (error) {
      console.error(
        '[SubscriptionContext] Failed to dismiss auto-renew adjusted alert:',
        error
      )
    }
  }, [user])

  /**
   * Update auto-renew preference on server
   * When disabled, also clears auto_renew_next_tier
   */
  const updateAutoRenew = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      if (!user) return false

      // When enabling, determine which tier to auto-renew into
      // When disabling, we'll set autoRenewNextTier to null
      const nextTierToSend = enabled
        ? autoRenewNextTier && autoRenewNextTier !== 'free'
          ? autoRenewNextTier
          : tier === 'plus' || tier === 'pro'
          ? tier
          : null
        : null // Clear when disabling

      setIsUpdatingAutoRenew(true)
      try {
        const execution = await functions.createExecution(
          'fn_update-auto-renew',
          JSON.stringify({
            autoRenew: enabled,
            // Always send autoRenewNextTier (null when disabled, tier when enabled)
            autoRenewNextTier: nextTierToSend,
          }),
          false,
          '/',
          ExecutionMethod.POST
        )

        const responseBody =
          execution.responseBody || (execution as any).response

        if (!responseBody) {
          throw new Error('Empty response from server')
        }

        const data = JSON.parse(responseBody)

        if (!data.success) {
          throw new Error(data.error || 'Failed to update auto-renew')
        }

        setAutoRenew(enabled)
        // Update local state: set tier when enabled, null when disabled
        setAutoRenewNextTier(nextTierToSend)
        return true
      } catch (error) {
        console.error(
          '[SubscriptionContext] Failed to update auto-renew:',
          error
        )
        return false
      } finally {
        setIsUpdatingAutoRenew(false)
      }
    },
    [user, autoRenewNextTier, tier]
  )

  /**
   * Update auto-renew tier preference (plus/pro) on server.
   * Uses the existing autoRenew boolean on the server record.
   */
  const updateAutoRenewNextTier = useCallback(
    async (nextTier: 'plus' | 'pro'): Promise<boolean> => {
      if (!user) return false

      setIsUpdatingAutoRenew(true)
      try {
        const execution = await functions.createExecution(
          'fn_update-auto-renew',
          JSON.stringify({ autoRenew, autoRenewNextTier: nextTier }),
          false,
          '/',
          ExecutionMethod.POST
        )

        const responseBody =
          execution.responseBody || (execution as any).response

        if (!responseBody) {
          throw new Error('Empty response from server')
        }

        const data = JSON.parse(responseBody)

        if (!data.success) {
          throw new Error(data.error || 'Failed to update auto-renew tier')
        }

        setAutoRenewNextTier(nextTier)
        return true
      } catch (error) {
        console.error(
          '[SubscriptionContext] Failed to update auto-renew tier:',
          error
        )
        return false
      } finally {
        setIsUpdatingAutoRenew(false)
      }
    },
    [user, autoRenew]
  )

  const value: SubscriptionContextType = {
    tier,
    source,
    features,
    isLoading,
    isPremium: tier === 'plus' || tier === 'pro',
    expiresAt,
    daysRemaining,
    expiringSoon,
    autoRenew,
    autoRenewNextTier,
    autoRenewFailedAt,
    autoRenewFailedDismissed,
    autoRenewAdjustedAt,
    autoRenewAdjustedDismissed,
    isUpdatingAutoRenew,
    refreshSubscription,
    updateAutoRenew,
    updateAutoRenewNextTier,
    dismissAutoRenewFailed,
    dismissAutoRenewAdjusted,
    hasFeature,
    getTierDisplayName,
    getTierEmoji,
  }

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export const useSubscription = () => useContext(SubscriptionContext)

// Export tier features for reference
export { TIER_FEATURES }
