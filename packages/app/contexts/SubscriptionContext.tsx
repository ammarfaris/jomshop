'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'
import { useAuth } from 'app/contexts/AuthContext'
import { getSupabaseSubscription } from 'app/lib/supabase'

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

    // Read the user's real tier from public.subscriptions (self-RLS) so the UI's
    // limits agree with what the receipts Edge Function enforces. (Auto-renew
    // *writes* aren't migrated to Supabase yet, but reads keep limits honest.)
    try {
      const sub = await getSupabaseSubscription()
      const exp = sub?.expiresAt ? new Date(sub.expiresAt) : null
      // Mirror the receipts Edge Function's getTier(): a lapsed subscription is
      // the free tier, so the UI's limits/features match what the server allows.
      const expired = exp != null && exp.getTime() < Date.now()
      const t: SubscriptionTier = expired ? 'free' : sub?.tier ?? 'free'
      const days =
        exp != null
          ? Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null
      setTier(t)
      setSource(expired ? 'none' : sub?.source ?? 'none')
      setFeatures(TIER_FEATURES[t])
      setExpiresAt(exp)
      setDaysRemaining(days)
      setExpiringSoon(days != null && days >= 0 && days <= 7)
      setAutoRenew(sub?.autoRenew ?? false)
      setAutoRenewNextTier(sub?.autoRenewNextTier ?? null)
      setAutoRenewFailedAt(
        sub?.autoRenewFailedAt ? new Date(sub.autoRenewFailedAt) : null
      )
      // The Supabase subscriptions table has no dismissed/adjusted columns yet.
      setAutoRenewFailedDismissed(false)
      setAutoRenewAdjustedAt(null)
      setAutoRenewAdjustedDismissed(false)
    } catch (error) {
      console.error(
        '[SubscriptionContext] Failed to read Supabase subscription:',
        error
      )
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
    // Auto-renew alerts aren't persisted on Supabase yet; dismiss locally.
    setAutoRenewFailedDismissed(true)
  }, [user])

  /**
   * Dismiss auto-renew adjusted alert after user acknowledges
   * This sets the dismissed flag on server and locally
   * Preserves the timestamp for auditing purposes
   * Note: Does NOT send autoRenew to avoid unintentionally modifying the preference
   */
  const dismissAutoRenewAdjusted = useCallback(async () => {
    if (!user) return
    // Auto-renew alerts aren't persisted on Supabase yet; dismiss locally.
    setAutoRenewAdjustedDismissed(true)
  }, [user])

  /**
   * Update auto-renew preference on server
   * When disabled, also clears auto_renew_next_tier
   */
  const updateAutoRenew = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      if (!user) return false

      // Auto-renew persistence isn't migrated to Supabase yet, so this updates
      // local UI state only (it does not survive a reload). Pick the tier to
      // show as the renew target when enabling; clear it when disabling.
      const nextTierToSend = enabled
        ? autoRenewNextTier && autoRenewNextTier !== 'free'
          ? autoRenewNextTier
          : tier === 'plus' || tier === 'pro'
          ? tier
          : null
        : null

      setIsUpdatingAutoRenew(true)
      try {
        setAutoRenew(enabled)
        setAutoRenewNextTier(nextTierToSend)
        return true
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

      // Local-only until auto-renew is migrated to Supabase (see updateAutoRenew).
      setIsUpdatingAutoRenew(true)
      try {
        setAutoRenewNextTier(nextTier)
        return true
      } finally {
        setIsUpdatingAutoRenew(false)
      }
    },
    [user]
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
