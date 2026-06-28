'use client'

import { useState, useEffect } from 'react'
import {
  View,
  Pressable,
  Modal,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native'
import { Text } from 'app/components/ui/text'
import { Switch } from 'app/components/ui/switch'
import { Skeleton } from 'app/components/ui/skeleton'
import { RadioGroup, RadioGroupItem } from 'app/components/ui/radio-group'
import {
  useSubscription,
  type SubscriptionTier,
} from 'app/contexts/SubscriptionContext'
import { usePoints, REDEMPTION_COSTS } from 'app/contexts/PointsContext'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { cn } from 'app/lib/utils'
import { Trans } from '@lingui/react/macro'
import { XMarkOutline } from 'app/components/icons-svg/XMarkOutline'

interface UpgradeModalProps {
  visible: boolean
  onClose: () => void
  featureName?: string
}

type PaymentMethod = 'card' | 'points'

interface TierOption {
  tier: SubscriptionTier
  name: string
  emoji: string
  price: string
  period: string
  pointsCost: number
  features: string[]
  highlighted?: boolean
}

const TIER_OPTIONS: TierOption[] = [
  {
    tier: 'free',
    name: 'Free',
    emoji: '🆓',
    price: 'RM0',
    period: 'forever',
    pointsCost: 0,
    features: [
      'Basic contest browsing',
      'Upload receipts to up to 5 saved contests',
      'Upload max 3 receipts per saved contest',
      'Default green theme',
    ],
  },
  {
    tier: 'plus',
    name: 'Plus',
    emoji: '⭐',
    price: 'RM1.99',
    period: '/month',
    pointsCost: REDEMPTION_COSTS.plus,
    features: [
      'All Free features',
      'Custom color themes',
      'Upload receipts to unlimited contests',
      'Upload max 10 receipts per saved contest',
      'Reduced Ads',
    ],
    highlighted: true,
  },
  {
    tier: 'pro',
    name: 'Pro',
    emoji: '👑',
    price: 'RM4.99',
    period: '/month',
    pointsCost: REDEMPTION_COSTS.pro,
    features: [
      'All Plus features',
      'Upload unlimited receipts per saved contest',
      'Priority support',
      'NO Ads',
    ],
  },
]

// Helper component for feature list items
function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-green-500">✓</Text>
      <Text className="text-sm text-gray-600 dark:text-gray-400">
        {children}
      </Text>
    </View>
  )
}

// Tab selector component with auto-renew option
function PaymentMethodTabs({
  selected,
  onSelect,
  pointsBalance,
  currentTier,
  showAutoRenew,
  autoRenew,
  autoRenewNextTier,
  autoRenewFailedAt,
  autoRenewFailedDismissed,
  autoRenewAdjustedAt,
  autoRenewAdjustedDismissed,
  onAutoRenewChange,
  onAutoRenewNextTierChange,
  onDismissFailedAlert,
  onDismissAdjustedAlert,
  isUpdatingAutoRenew,
}: {
  selected: PaymentMethod
  onSelect: (method: PaymentMethod) => void
  pointsBalance: number
  currentTier: SubscriptionTier
  showAutoRenew: boolean
  autoRenew: boolean
  autoRenewNextTier: SubscriptionTier | null
  autoRenewFailedAt: Date | null
  autoRenewFailedDismissed: boolean
  autoRenewAdjustedAt: Date | null
  autoRenewAdjustedDismissed: boolean
  onAutoRenewChange: (enabled: boolean) => void
  onAutoRenewNextTierChange: (tier: 'plus' | 'pro') => void
  onDismissFailedAlert: () => void
  onDismissAdjustedAlert: () => void
  isUpdatingAutoRenew: boolean
}) {
  const canShowNextTierChoices = currentTier === 'plus' || currentTier === 'pro'
  const maintainTier: 'plus' | 'pro' | null =
    currentTier === 'plus' ? 'plus' : currentTier === 'pro' ? 'pro' : null
  const alternateTier: 'plus' | 'pro' | null =
    currentTier === 'plus' ? 'pro' : currentTier === 'pro' ? 'plus' : null

  return (
    <View className="mb-4">
      <View className="flex-row bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        <Pressable
          onPress={() => onSelect('points')}
          className={cn(
            'flex-1 py-2 px-3 rounded-lg',
            selected === 'points' ? 'bg-white dark:bg-gray-700' : ''
          )}
        >
          <Text
            className={cn(
              'text-center font-medium text-sm',
              selected === 'points' ? 'text-main' : 'text-gray-500'
            )}
          >
            🪙 <Trans>Use Points</Trans>{' '}
            <Text className="text-xs text-gray-400">({pointsBalance})</Text>
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onSelect('card')}
          className={cn(
            'flex-1 py-2 px-3 rounded-lg',
            selected === 'card' ? 'bg-white dark:bg-gray-700' : ''
          )}
        >
          <Text
            className={cn(
              'text-center font-medium text-sm',
              selected === 'card' ? 'text-main' : 'text-gray-500'
            )}
          >
            💳 <Trans>Pay Online</Trans>
          </Text>
        </Pressable>
      </View>

      {/* Auto-renew toggle - shown below tabs when using points and has paid subscription */}
      {selected === 'points' && showAutoRenew && (
        <View className="mt-3 px-1">
          {/* Alert for adjusted auto-renewal (succeeded but at lower tier) - only show if not dismissed */}
          {autoRenewAdjustedAt &&
            !autoRenewAdjustedDismissed &&
            !autoRenewFailedAt && (
              <View className="mb-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      ⚠️ <Trans>Auto-renew adjusted</Trans>
                    </Text>
                    <Text className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                      <Trans>
                        Renewed at a lower tier due to insufficient points. Add
                        more points to renew at your preferred tier.
                      </Trans>
                    </Text>
                  </View>
                  <Pressable onPress={onDismissAdjustedAlert} className="p-1">
                    <Text className="text-amber-500">✕</Text>
                  </Pressable>
                </View>
              </View>
            )}
          {/* Alert for failed auto-renewal (only shows when renewal completely failed and not dismissed) */}
          {autoRenewFailedAt && !autoRenewFailedDismissed && (
            <View className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-red-700 dark:text-red-400">
                    ⚠️ <Trans>Auto-renew failed</Trans>
                  </Text>
                  <Text className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                    <Trans>
                      Insufficient points to renew. Add more points to
                      re-enable.
                    </Trans>
                  </Text>
                </View>
                <Pressable onPress={onDismissFailedAlert} className="p-1">
                  <Text className="text-red-500">✕</Text>
                </Pressable>
              </View>
            </View>
          )}
          <View className="flex-row items-center gap-2">
            <Text className="font-medium text-sm">
              🔄 <Trans>Auto-renew with Points</Trans>
            </Text>
            {isUpdatingAutoRenew ? (
              <Skeleton className="h-[1.15rem] w-8 rounded-full" />
            ) : (
              <Switch
                checked={autoRenew}
                onCheckedChange={onAutoRenewChange}
                disabled={isUpdatingAutoRenew}
              />
            )}
          </View>
          <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {autoRenew ? (
              <Trans>
                Your plan will attempt to auto-renew when it expires
              </Trans>
            ) : (
              <Trans>
                Your plan will NOT attempt to auto-renew when it expires
              </Trans>
            )}
          </Text>

          {/* Auto-renew tier choice - only shown when auto-renew is ON */}
          {autoRenew &&
            canShowNextTierChoices &&
            maintainTier &&
            alternateTier && (
              <RadioGroup
                value={autoRenewNextTier || maintainTier}
                onValueChange={(value) => {
                  if (value === 'plus' || value === 'pro') {
                    onAutoRenewNextTierChange(value)
                  }
                }}
                disabled={isUpdatingAutoRenew}
                className="mt-3 gap-2"
              >
                <View className="flex-row items-center gap-2">
                  <RadioGroupItem
                    value={maintainTier}
                    disabled={isUpdatingAutoRenew}
                    aria-labelledby="maintain-plan-label"
                  />
                  <Text nativeID="maintain-plan-label" className="text-sm">
                    <Trans>Maintain current plan*</Trans>
                  </Text>
                </View>

                <View className="flex-row items-center gap-2">
                  <RadioGroupItem
                    value={alternateTier}
                    disabled={isUpdatingAutoRenew}
                    aria-labelledby="alternate-plan-label"
                  />
                  <Text nativeID="alternate-plan-label" className="text-sm">
                    {currentTier === 'plus' ? (
                      <Trans>Upgrade to Pro Plan*</Trans>
                    ) : (
                      <Trans>Downgrade to Plus Plan*</Trans>
                    )}
                  </Text>
                </View>

                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  <Trans>
                    *if sufficient points, if not tier will be lowered
                    accordingly
                  </Trans>
                </Text>
              </RadioGroup>
            )}
        </View>
      )}
    </View>
  )
}

export function UpgradeModal({
  visible,
  onClose,
  featureName,
}: UpgradeModalProps) {
  const {
    tier: currentTier,
    isLoading: subscriptionLoading,
    refreshSubscription,
    autoRenew,
    autoRenewNextTier,
    autoRenewFailedAt,
    autoRenewFailedDismissed,
    autoRenewAdjustedAt,
    autoRenewAdjustedDismissed,
    updateAutoRenew,
    updateAutoRenewNextTier,
    dismissAutoRenewFailed,
    dismissAutoRenewAdjusted,
    isUpdatingAutoRenew,
    expiringSoon,
  } = useSubscription()
  const {
    balance,
    canRedeemPlus,
    canRedeemPro,
    redeemForSubscription,
    isRedeeming,
  } = usePoints()
  const { isDarkColorScheme } = useColorScheme()
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('points')
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(
    null
  )
  const [isProcessing, setIsProcessing] = useState(false)

  // Lock body scroll on web when modal is visible (especially for iOS Safari)
  useEffect(() => {
    if (Platform.OS === 'web' && visible) {
      // Save original styles
      const originalOverflow = document.body.style.overflow
      const originalPosition = document.body.style.position
      const originalTop = document.body.style.top
      const originalWidth = document.body.style.width
      const scrollY = window.scrollY

      // Prevent scrolling with iOS Safari fix
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'

      // Restore original styles when modal closes
      return () => {
        document.body.style.overflow = originalOverflow
        document.body.style.position = originalPosition
        document.body.style.top = originalTop
        document.body.style.width = originalWidth
        window.scrollTo(0, scrollY)
      }
    }
  }, [visible])

  const isLoading = subscriptionLoading || isProcessing || isRedeeming

  const handleCardPurchase = async (tier: SubscriptionTier) => {
    if (tier === currentTier || tier === 'free') return

    setSelectedTier(tier)
    setIsProcessing(true)

    try {
      // TODO: Integrate with RevenueCat purchase flow
      // import Purchases from 'react-native-purchases'
      // const products = await Purchases.getProducts(['jc_plus_monthly', 'jc_pro_monthly'])
      // await Purchases.purchaseProduct(tier === 'plus' ? 'jc_plus_monthly' : 'jc_pro_monthly')

      // For now, show a message that this will be implemented
      console.log('Card purchase for tier:', tier)
      // TODO: After successful purchase, RevenueCat webhook will update the subscription

      // Refresh subscription after purchase (in production)
      await refreshSubscription()
      onClose()
    } catch (error) {
      console.error('Card purchase failed:', error)
      // TODO: Show error toast
    } finally {
      setSelectedTier(null)
      setIsProcessing(false)
    }
  }

  const handlePointsRedemption = async (tier: SubscriptionTier) => {
    if (tier === 'free') return

    // Prevent stacking / switching while an active plan is running:
    // - Allow renewing the current plan only when it's expiring soon (<= 7 days)
    // - Disallow switching tiers until expiry (use auto-renew choice instead)
    if (currentTier !== 'free') {
      if (tier !== currentTier) return
      if (!expiringSoon) return
    }

    // Check if user has enough points
    if (tier === 'plus' && !canRedeemPlus) return
    if (tier === 'pro' && !canRedeemPro) return

    setSelectedTier(tier)

    try {
      // console.log('[UpgradeModal] Starting points redemption for tier:', tier)
      const result = await redeemForSubscription(tier as 'plus' | 'pro')
      // console.log('[UpgradeModal] Redemption result:', result)
      if (result.success) {
        // console.log('[UpgradeModal] Refreshing subscription...')
        await refreshSubscription()
        // console.log('[UpgradeModal] Subscription refreshed, closing modal')
        onClose()
      } else {
        console.error('Points redemption failed:', result.error)
        // TODO: Show error toast
      }
    } catch (error) {
      console.error('Points redemption failed:', error)
    } finally {
      setSelectedTier(null)
    }
  }

  const handleSelectTier = async (tier: SubscriptionTier) => {
    if (paymentMethod === 'card') {
      await handleCardPurchase(tier)
    } else {
      await handlePointsRedemption(tier)
    }
  }

  const canSelectTier = (tier: SubscriptionTier): boolean => {
    if (tier === 'free') return false
    if (paymentMethod === 'points') {
      if (currentTier !== 'free') {
        // Allow renewing current plan only when it's expiring soon (<= 7 days)
        if (tier === currentTier) return expiringSoon
        // Disallow switching tiers until expiry (use auto-renew choice instead)
        return false
      }
      if (tier === 'plus') return canRedeemPlus
      if (tier === 'pro') return canRedeemPro
    }
    return true
  }

  const getTierButtonText = (
    tier: SubscriptionTier,
    option: TierOption
  ): React.ReactNode => {
    if (tier === currentTier) {
      // Show both price and points for current tier
      if (paymentMethod === 'card') {
        return (
          <Text>
            <Trans>Current</Trans> - {option.price}
          </Text>
        )
      } else {
        return (
          <Text>
            <Trans>Current</Trans> - {option.pointsCost} pts
          </Text>
        )
      }
    }
    if (tier === 'free') {
      return <Trans>Downgrade</Trans>
    }
    if (paymentMethod === 'points') {
      const hasEnough = tier === 'plus' ? canRedeemPlus : canRedeemPro
      if (!hasEnough) {
        return <Trans>Need {option.pointsCost - balance} more</Trans>
      }
      return <Trans>Redeem {option.pointsCost} pts</Trans>
    }
    return option.price
  }

  const renderTierOptions = () => (
    <View className="gap-3 mb-4">
      {TIER_OPTIONS.filter((o) => o.tier !== 'free').map((option) => {
        const isCurrentTier = option.tier === currentTier
        const isSelected = selectedTier === option.tier
        const canSelect = canSelectTier(option.tier)

        return (
          <Pressable
            key={option.tier}
            onPress={() => handleSelectTier(option.tier)}
            disabled={isLoading || !canSelect}
            className={cn(
              'rounded-xl border-2 p-4',
              option.highlighted && !isCurrentTier
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                : isCurrentTier
                ? 'border-main bg-main/10'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800',
              (!canSelect || isLoading) && !isSelected ? 'opacity-50' : ''
            )}
          >
            <View className="flex-row justify-between items-center mb-2">
              <View className="flex-row items-center gap-2">
                <Text className="text-xl">{option.emoji}</Text>
                <Text className="text-lg font-bold">{option.name}</Text>
              </View>
              <View className="items-end">
                {isSelected && isLoading ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <View className="bg-main/10 px-3 py-1 rounded-full">
                    <Text className="text-sm font-semibold color-main">
                      {getTierButtonText(option.tier, option)}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View className="gap-1">
              {option.tier === 'plus' && (
                <>
                  <FeatureItem>
                    <Trans>All Free features</Trans>
                  </FeatureItem>
                  <FeatureItem>
                    <Trans>Custom color themes</Trans>
                  </FeatureItem>
                  <FeatureItem>
                    <Trans>Upload receipts to unlimited contests</Trans>
                  </FeatureItem>
                  <FeatureItem>
                    <Trans>Upload max 10 receipts per saved contest</Trans>
                  </FeatureItem>
                  <FeatureItem>
                    <Trans>Reduced Ads</Trans>
                  </FeatureItem>
                </>
              )}
              {option.tier === 'pro' && (
                <>
                  <FeatureItem>
                    <Trans>All Plus features</Trans>
                  </FeatureItem>
                  <FeatureItem>
                    <Trans>Upload unlimited receipts per saved contest</Trans>
                  </FeatureItem>
                  <FeatureItem>
                    <Trans>Priority support</Trans>
                  </FeatureItem>
                  <FeatureItem>
                    <Trans>NO Ads</Trans>
                  </FeatureItem>
                </>
              )}
            </View>
          </Pressable>
        )
      })}
    </View>
  )

  const renderPayOnlineComingSoon = () => (
    <View className="py-10 items-center justify-center">
      <Text className="text-base font-medium text-gray-500 dark:text-gray-400 text-center">
        <Trans>Coming soon...</Trans>
      </Text>
    </View>
  )

  const renderHeader = () => (
    <View className="flex-row justify-between items-start mb-4">
      <View className="flex-1">
        <Text className="text-2xl font-bold mb-1">
          <Trans>Upgrade Your Plan</Trans>
        </Text>
        {featureName && (
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            <Trans>Unlock {featureName} and more premium features</Trans>
          </Text>
        )}
      </View>
      <Pressable onPress={onClose} className="p-2 -mr-2 -mt-2">
        <XMarkOutline width={24} height={24} className="text-gray-500" />
      </Pressable>
    </View>
  )

  const renderFooter = () => (
    <View className="gap-2">
      {paymentMethod === 'card' && (
        <Text className="text-xs text-center text-gray-400 dark:text-gray-500">
          <Trans>
            We are working hard on this, you can opt for points redemption for
            now...
          </Trans>
        </Text>
      )}
      {paymentMethod === 'points' && (
        <Text className="text-xs text-center text-gray-400 dark:text-gray-500">
          <Trans>
            Points redemption gives you 1 month of the selected plan. Earn
            points by referring friends, more ways to earn points coming later!
          </Trans>
        </Text>
      )}
    </View>
  )

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-center items-center p-4">
        {/* Backdrop - tap to close */}
        <Pressable className="absolute inset-0" onPress={onClose} />
        {/* Modal Content Container */}
        <View
          className={cn(
            'w-full max-w-md rounded-2xl overflow-hidden',
            isDarkColorScheme ? 'bg-gray-900' : 'bg-white'
          )}
          style={{
            maxHeight: '100%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 5,
          }}
        >
          <ScrollView
            className="p-6"
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {renderHeader()}
            {/* Show failed auto-renewal alert even for free users (only if not dismissed) */}
            {autoRenewFailedAt &&
              !autoRenewFailedDismissed &&
              currentTier === 'free' && (
                <View className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                        ⚠️ <Trans>Auto-renewal failed</Trans>
                      </Text>
                      <Text className="text-xs text-red-600 dark:text-red-500">
                        <Trans>
                          Your subscription expired due to insufficient points.
                          Add more points to renew.
                        </Trans>
                      </Text>
                    </View>
                    <Pressable
                      onPress={dismissAutoRenewFailed}
                      className="p-1 ml-2"
                    >
                      <Text className="text-red-500">✕</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            <PaymentMethodTabs
              selected={paymentMethod}
              onSelect={setPaymentMethod}
              pointsBalance={balance}
              showAutoRenew={currentTier !== 'free'}
              autoRenew={autoRenew}
              autoRenewNextTier={autoRenewNextTier}
              currentTier={currentTier}
              autoRenewFailedAt={autoRenewFailedAt}
              autoRenewFailedDismissed={autoRenewFailedDismissed}
              autoRenewAdjustedAt={autoRenewAdjustedAt}
              autoRenewAdjustedDismissed={autoRenewAdjustedDismissed}
              onAutoRenewChange={updateAutoRenew}
              onAutoRenewNextTierChange={updateAutoRenewNextTier}
              onDismissFailedAlert={dismissAutoRenewFailed}
              onDismissAdjustedAlert={dismissAutoRenewAdjusted}
              isUpdatingAutoRenew={isUpdatingAutoRenew}
            />
            {paymentMethod === 'card'
              ? renderPayOnlineComingSoon()
              : renderTierOptions()}
            {renderFooter()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
