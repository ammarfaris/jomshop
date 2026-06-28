'use client'

import { useState } from 'react'
import { View, Pressable, ActivityIndicator } from 'react-native'
import { Text } from 'app/components/ui/text'
import { usePoints, REDEMPTION_COSTS } from 'app/contexts/PointsContext'
import { useAuth } from 'app/contexts/AuthContext'
import { cn } from 'app/lib/utils'
import { Trans, Plural } from '@lingui/react/macro'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { PointsTransactionModal } from './PointsTransactionModal'

interface PointsBalanceProps {
  /** Show compact version (just balance) */
  compact?: boolean
  /** Show detailed breakdown with redemption options */
  showDetails?: boolean
  /** Callback when user taps to see full points history */
  onViewHistory?: () => void
  /** Additional className */
  className?: string
}

export function PointsBalance({
  compact = false,
  showDetails = false,
  onViewHistory,
  className,
}: PointsBalanceProps) {
  const { user } = useAuth()
  const {
    balance,
    lifetimeEarned,
    completedReferrals,
    canRedeemPlus,
    canRedeemPro,
    isLoading,
    error,
    refreshPoints,
  } = usePoints()
  const { isDarkColorScheme } = useColorScheme()
  const [showTransactionModal, setShowTransactionModal] = useState(false)

  // Don't show if user is not logged in
  if (!user) return null

  // Compact version - just shows balance
  if (compact) {
    const handleOpenTransactionModal = () => {
      refreshPoints()
      setShowTransactionModal(true)
    }

    return (
      <>
        <Pressable
          onPress={handleOpenTransactionModal}
          className={cn('flex-row items-center gap-1', className)}
        >
          <Text className="text-lg">🪙</Text>
          {isLoading ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text className="font-semibold text-base color-main">
              {balance.toLocaleString()}{' '}
              <Plural value={balance} one="point" other="points" />
            </Text>
          )}
        </Pressable>
        <PointsTransactionModal
          visible={showTransactionModal}
          onClose={() => setShowTransactionModal(false)}
        />
      </>
    )
  }

  // Full card version
  return (
    <View
      className={cn(
        'rounded-2xl p-4',
        isDarkColorScheme ? 'bg-gray-800' : 'bg-gray-50',
        className
      )}
    >
      {/* Header with balance */}
      <View className="flex-row justify-between items-center mb-3">
        <Pressable
          onPress={() => {
            refreshPoints()
            setShowTransactionModal(true)
          }}
          className="flex-row items-center gap-2"
        >
          <Text className="text-2xl">🪙</Text>
          <View>
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              <Trans>Points Balance</Trans>
            </Text>
            {isLoading ? (
              <ActivityIndicator size="small" />
            ) : (
              <View className="flex-row items-center gap-1">
                <Text className="text-2xl font-bold color-main">
                  {balance.toLocaleString()}
                </Text>
                <Text className="text-xs text-gray-400 dark:text-gray-500">
                  ▶
                </Text>
              </View>
            )}
          </View>
        </Pressable>
        {onViewHistory && (
          <Pressable
            onPress={onViewHistory}
            className="px-3 py-1 rounded-full bg-main/10"
          >
            <Text className="text-sm color-main font-medium">
              <Trans>History</Trans>
            </Text>
          </Pressable>
        )}
      </View>

      {/* Points Transaction Modal */}
      <PointsTransactionModal
        visible={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
      />

      {/* Error state */}
      {error && (
        <Pressable
          onPress={refreshPoints}
          className="bg-red-100 dark:bg-red-900/30 rounded-lg p-2 mb-3"
        >
          <Text className="text-sm text-red-600 dark:text-red-400 text-center">
            <Trans>Failed to load points. Tap to retry.</Trans>
          </Text>
        </Pressable>
      )}

      {/* Details section */}
      {showDetails && !isLoading && (
        <View className="gap-3">
          {/* Stats row */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-white dark:bg-gray-700 rounded-xl p-3">
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                <Trans>Lifetime Earned</Trans>
              </Text>
              <Text className="text-lg font-semibold">
                {lifetimeEarned.toLocaleString()}
              </Text>
            </View>
            <View className="flex-1 bg-white dark:bg-gray-700 rounded-xl p-3">
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                <Trans>Referrals</Trans>
              </Text>
              <Text className="text-lg font-semibold">
                {completedReferrals}
              </Text>
            </View>
          </View>

          {/* Redemption progress */}
          <View className="bg-white dark:bg-gray-700 rounded-xl p-3">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              <Trans>Redeem for Subscription</Trans>
            </Text>

            {/* Plus tier progress */}
            <View className="mb-2">
              <View className="flex-row justify-between items-center mb-1">
                <View className="flex-row items-center gap-1">
                  <Text>⭐</Text>
                  <Text className="text-sm font-medium">
                    <Trans>Plus (1 month)</Trans>
                  </Text>
                </View>
                <Text className="text-xs text-gray-500">
                  {balance}/{REDEMPTION_COSTS.plus}
                </Text>
              </View>
              <View className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <View
                  className={cn(
                    'h-full rounded-full',
                    canRedeemPlus ? 'bg-green-500' : 'bg-amber-500'
                  )}
                  style={{
                    width: `${Math.min(
                      (balance / REDEMPTION_COSTS.plus) * 100,
                      100
                    )}%`,
                  }}
                />
              </View>
              {canRedeemPlus && (
                <Text className="text-xs text-green-600 dark:text-green-400 mt-1">
                  ✓ <Trans>Ready to redeem!</Trans>
                </Text>
              )}
            </View>

            {/* Pro tier progress */}
            <View>
              <View className="flex-row justify-between items-center mb-1">
                <View className="flex-row items-center gap-1">
                  <Text>👑</Text>
                  <Text className="text-sm font-medium">
                    <Trans>Pro (1 month)</Trans>
                  </Text>
                </View>
                <Text className="text-xs text-gray-500">
                  {balance}/{REDEMPTION_COSTS.pro}
                </Text>
              </View>
              <View className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <View
                  className={cn(
                    'h-full rounded-full',
                    canRedeemPro ? 'bg-green-500' : 'bg-purple-500'
                  )}
                  style={{
                    width: `${Math.min(
                      (balance / REDEMPTION_COSTS.pro) * 100,
                      100
                    )}%`,
                  }}
                />
              </View>
              {canRedeemPro && (
                <Text className="text-xs text-green-600 dark:text-green-400 mt-1">
                  ✓ <Trans>Ready to redeem!</Trans>
                </Text>
              )}
            </View>
          </View>

          {/* How to earn */}
          <View className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
            <Text className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
              <Trans>How to Earn Points</Trans>
            </Text>
            <View className="gap-1">
              <Text className="text-xs text-amber-700 dark:text-amber-300">
                🧾 <Trans>Upload receipts: +10 points each</Trans>
              </Text>
              <Text className="text-xs text-amber-700 dark:text-amber-300">
                👥 <Trans>Refer a friend: +200 points</Trans>
              </Text>
              <Text className="text-xs text-amber-700 dark:text-amber-300">
                🎉 <Trans>Sign up bonus: +100 points</Trans>
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
