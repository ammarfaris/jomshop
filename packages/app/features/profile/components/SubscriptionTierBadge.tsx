'use client'

import { View } from 'react-native'
import { Text } from 'app/components/ui/text'
import {
  useSubscription,
  type SubscriptionTier,
} from 'app/contexts/SubscriptionContext'
import { cn } from 'app/lib/utils'
import { Skeleton } from 'app/components/ui/skeleton'

interface SubscriptionTierBadgeProps {
  size?: 'sm' | 'md' | 'lg'
  showEmoji?: boolean
  className?: string
}

export function SubscriptionTierBadge({
  size = 'md',
  showEmoji = true,
  className,
}: SubscriptionTierBadgeProps) {
  const { tier, getTierDisplayName, getTierEmoji, isLoading } =
    useSubscription()

  const getBadgeStyles = (tier: SubscriptionTier): string => {
    const baseStyles = 'rounded-full flex-row items-center justify-center'

    switch (tier) {
      case 'free':
        return cn(baseStyles, 'bg-gray-100 dark:bg-gray-800')
      case 'plus':
        return cn(baseStyles, 'bg-amber-100 dark:bg-amber-900/30')
      case 'pro':
        return cn(baseStyles, 'bg-purple-100 dark:bg-purple-900/30')
      default:
        return cn(baseStyles, 'bg-gray-100 dark:bg-gray-800')
    }
  }

  const getTextStyles = (tier: SubscriptionTier): string => {
    switch (tier) {
      case 'free':
        return 'text-gray-600 dark:text-gray-400'
      case 'plus':
        return 'text-amber-600 dark:text-amber-400'
      case 'pro':
        return 'text-purple-600 dark:text-purple-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getSizeStyles = (): {
    container: string
    text: string
    emoji: string
  } => {
    switch (size) {
      case 'sm':
        return {
          container: 'px-2 py-0.5',
          text: 'text-xs font-medium',
          emoji: 'text-xs mr-1',
        }
      case 'md':
        return {
          container: 'px-3 py-1',
          text: 'text-sm font-semibold',
          emoji: 'text-sm mr-1.5',
        }
      case 'lg':
        return {
          container: 'px-4 py-1.5',
          text: 'text-base font-bold',
          emoji: 'text-base mr-2',
        }
    }
  }

  const sizeStyles = getSizeStyles()

  // Show skeleton while loading
  if (isLoading) {
    return (
      <Skeleton
        className={cn(
          'rounded-full',
          size === 'sm' ? 'w-14 h-5' : size === 'md' ? 'w-16 h-6' : 'w-20 h-7',
          className
        )}
      />
    )
  }

  return (
    <View className={cn(getBadgeStyles(tier), sizeStyles.container, className)}>
      {showEmoji && <Text className={sizeStyles.emoji}>{getTierEmoji()}</Text>}
      <Text className={cn(getTextStyles(tier), sizeStyles.text)}>
        {getTierDisplayName()}
      </Text>
    </View>
  )
}
