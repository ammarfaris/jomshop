import {
  ActivityIndicator,
  View,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native'
import { useState } from 'react'
import { Trans } from '@lingui/react/macro'
import { useColorTheme } from 'app/contexts/ColorThemeContext'
import { useColorThemeValues } from 'app/hooks/useColorThemeValues'
import { useSubscription } from 'app/contexts/SubscriptionContext'
import { cn } from 'app/lib/utils'

import { ButtonIconAndText } from 'app/components/ButtonIconAndText'
import { LogoutOutline } from 'app/components/icons-svg/LogoutOutline'
import { Text } from 'app/components/ui/text'
import { UserAvatar } from 'app/components/UserAvatar'
import { ThemeSelector } from 'app/features/profile/components/ThemeSelector.web'
import { ColorThemeSelector } from 'app/features/profile/components/ColorThemeSelector'
import { TextScaleSelector } from 'app/features/profile/components/TextScaleSelector'
import { SubscriptionTierBadge } from 'app/features/profile/components/SubscriptionTierBadge'
import { UpgradeModal } from 'app/features/profile/components/UpgradeModal'
import { ReferralCard } from 'app/features/profile/components/ReferralCard'
import { PointsBalance } from 'app/features/profile/components/PointsBalance'
import { Skeleton } from 'app/components/ui/skeleton'
import { Link } from 'app/lib/link-universal'
import { ChevronRightOutline } from 'app/components/icons-svg/ChevronRightOutline'

function GeneralTabContent({
  user,
  userDisplayName,
  userEmail,
  currentLocale,
  isLoadingLanguage,
  toggleLanguage,
  handleSignOut,
  isLoggingOut,
  isDarkColorScheme,
}: {
  user: any
  userDisplayName?: string
  userEmail?: string
  currentLocale: string
  isLoadingLanguage: boolean
  toggleLanguage: () => void
  handleSignOut: () => void
  isLoggingOut: boolean
  isDarkColorScheme: boolean
}) {
  const { colorTheme } = useColorTheme()
  const { main } = useColorThemeValues(isDarkColorScheme)
  const {
    tier,
    isPremium,
    getTierDisplayName,
    getTierEmoji,
    expiresAt,
    daysRemaining,
    expiringSoon,
    autoRenewFailedAt,
    isLoading: isSubscriptionLoading,
  } = useSubscription()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  // Format expiry date for display
  const getExpiryText = () => {
    if (!expiresAt || tier === 'free') return null

    const d = expiresAt.getDate()
    const m = expiresAt.getMonth() + 1
    const y = expiresAt.getFullYear()
    let hours = expiresAt.getHours()
    const minutes = expiresAt.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'pm' : 'am'
    hours = hours % 12
    hours = hours ? hours : 12 // the hour '0' should be '12'
    const formattedDate = `${d}/${m}/${y}, ${hours}:${minutes}${ampm}`

    if (daysRemaining !== null && daysRemaining < 0) {
      return <Trans>Expired on {formattedDate}</Trans>
    }

    return <Trans>Expires on {formattedDate}</Trans>
  }

  const getRemainingTimeBadgeText = () => {
    if (!expiresAt || tier === 'free') return null

    const now = new Date()
    const diffMs = expiresAt.getTime() - now.getTime()

    if (diffMs <= 0) return <Trans>Expired</Trans>

    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays >= 1) {
      return <Trans>{diffDays}d left</Trans>
    } else if (diffHours >= 1) {
      return <Trans>{diffHours}h left</Trans>
    } else {
      return <Trans>{diffMinutes}m left</Trans>
    }
  }

  // Helper function to check if subscription is expiring in 24 hours or less
  const isExpiring24HoursOrLess = () => {
    if (!expiresAt || tier === 'free') return false
    const now = new Date()
    const diffMs = expiresAt.getTime() - now.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    return diffHours >= 0 && diffHours <= 24
  }

  // Helper function to get theme-aware border classes for native
  const getActiveBorderClass = () => {
    if (Platform.OS === 'web') {
      return 'border-main bg-main/10'
    }
    // On native, use hardcoded color classes based on colorTheme
    if (colorTheme === 'blue') return 'border-blue-500 bg-blue-500/10'
    if (colorTheme === 'purple') return 'border-purple-500 bg-purple-500/10'
    return 'border-green-600 bg-green-600/10'
  }

  // Helper function to get theme-aware text classes for native
  const getActiveTextClass = () => {
    if (Platform.OS === 'web') {
      return 'text-main'
    }
    // On native, use hardcoded color classes based on colorTheme
    if (colorTheme === 'blue') return 'text-blue-500'
    if (colorTheme === 'purple') return 'text-purple-500'
    return 'text-green-600'
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 16, gap: 16 }}
      showsVerticalScrollIndicator={false}
      style={
        Platform.OS === 'web'
          ? ({ scrollbarWidth: 'none', msOverflowStyle: 'none' } as any)
          : undefined
      }
    >
      <View className="w-full web:max-w-xl web:mx-auto flex-col gap-4">
        {/* User Avatar and Info */}
        {user && (
          <View className="w-full items-center gap-3 mb-2">
            <UserAvatar
              userId={user.$id}
              displayName={userDisplayName}
              size="xl"
            />
            <View className="items-center gap-1">
              <View className="flex-row items-center gap-2">
                <Text className="font-bold text-lg">{userDisplayName}</Text>
                <SubscriptionTierBadge size="sm" />
              </View>
              <Text className="text-sm text-gray-600 dark:text-gray-400">
                {userEmail}
              </Text>
              <PointsBalance compact className="mt-1" />
            </View>
          </View>
        )}

        {/* Subscription Section */}
        {user && (
          <>
            {isSubscriptionLoading ? (
              <View className="rounded-xl p-4 border-2 border-gray-200 dark:border-gray-700">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <View className="gap-2">
                      <Skeleton className="w-24 h-6 rounded" />
                      <Skeleton className="w-40 h-4 rounded" />
                    </View>
                  </View>
                  <Skeleton className="w-20 h-8 rounded-full" />
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowUpgradeModal(true)}
                className={cn(
                  'rounded-xl p-4 border-2',
                  tier === 'free'
                    ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                    : tier === 'plus'
                    ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
                    : 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20'
                )}
              >
                {/* Alert badge on its own row above the plan box */}
              {tier === 'free' && autoRenewFailedAt && (
                <View className="mb-2 self-start px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30">
                  <Text className="text-xs font-bold text-red-600 dark:text-red-400">
                    <Trans>Auto-renew failed</Trans>
                  </Text>
                </View>
              )}
              {tier === 'free' && !autoRenewFailedAt && expiresAt && (
                <View className="mb-2 self-start px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30">
                  <Text className="text-xs font-bold text-red-600 dark:text-red-400">
                    <Trans>Plan downgraded</Trans>
                  </Text>
                </View>
              )}
              <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3 flex-1 min-w-0">
                    <Text className="text-2xl">{getTierEmoji()}</Text>
                    <View className="flex-1 min-w-0">
                      <View className="flex-row items-center gap-2 flex-wrap">
                        <Text className="font-bold text-xl">
                          {tier === 'plus' ? (
                            <Trans>Plus Plan</Trans>
                          ) : tier === 'pro' ? (
                            <Trans>Pro Plan</Trans>
                          ) : (
                            <Trans>Free Plan</Trans>
                          )}
                        </Text>
                        {/* Badge for active plans showing remaining time */}
                        {tier !== 'free' && (
                          <View
                            className={cn(
                              'px-2.5 py-1 rounded-full',
                              isExpiring24HoursOrLess()
                                ? 'bg-red-100 dark:bg-red-900/30'
                                : expiringSoon
                                ? 'bg-orange-100 dark:bg-orange-900/30'
                                : 'bg-amber-100 dark:bg-amber-900/30'
                            )}
                          >
                            <Text
                              className={cn(
                                'text-xs font-bold',
                                isExpiring24HoursOrLess()
                                  ? 'text-red-600 dark:text-red-400'
                                  : expiringSoon
                                  ? 'text-orange-600 dark:text-orange-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              )}
                            >
                              {getRemainingTimeBadgeText()}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-sm text-gray-500 dark:text-gray-400">
                        {tier === 'free' ? (
                          <Trans>Upgrade for more features</Trans>
                        ) : getExpiryText() ? (
                          <Text
                            className={cn(
                              'text-sm',
                              isExpiring24HoursOrLess()
                                ? 'text-red-600 dark:text-red-400 font-medium'
                                : expiringSoon
                                ? 'text-orange-600 dark:text-orange-400 font-medium'
                                : 'text-gray-500 dark:text-gray-400'
                            )}
                          >
                            {getExpiryText()}
                          </Text>
                        ) : (
                          <Trans>Manage your subscription</Trans>
                        )}
                      </Text>
                    </View>
                  </View>
                  <View
                    className={cn(
                      'px-3 py-1.5 rounded-full flex-shrink-0 ml-2',
                      tier === 'free'
                        ? 'bg-main'
                        : 'bg-gray-200 dark:bg-gray-700'
                    )}
                  >
                    <Text
                      className={cn(
                        'font-semibold text-sm',
                        tier === 'free'
                          ? 'text-white'
                          : 'text-gray-600 dark:text-gray-300'
                      )}
                    >
                      {tier === 'free' ? (
                        <Trans>Upgrade</Trans>
                      ) : (
                        <Trans>Manage</Trans>
                      )}
                    </Text>
                  </View>
                </View>
              </Pressable>
            )}
          </>
        )}

        {/* Referral Section */}
        {user && <ReferralCard />}

        {/* Language Toggle */}
        <View>
          <Text className="mb-2 font-bold">
            {currentLocale === 'en' ? (
              <Trans>Language</Trans>
            ) : (
              <Trans>Bahasa</Trans>
            )}
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => {
                if (currentLocale !== 'en' && !isLoadingLanguage) {
                  toggleLanguage()
                }
              }}
              disabled={isLoadingLanguage}
              className={cn(
                'flex-1 rounded-lg border-2 p-3 items-center justify-center min-h-[80px]',
                currentLocale === 'en'
                  ? getActiveBorderClass()
                  : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800'
              )}
            >
              {isLoadingLanguage ? (
                <ActivityIndicator size="small" color={main} />
              ) : (
                <View className="items-center">
                  <Text
                    className={cn(
                      'text-2xl mb-1',
                      currentLocale === 'en'
                        ? getActiveTextClass()
                        : 'text-gray-700 dark:text-gray-300'
                    )}
                  >
                    🇬🇧
                  </Text>
                  <Text
                    className={cn(
                      'font-medium text-center',
                      currentLocale === 'en'
                        ? getActiveTextClass()
                        : 'text-gray-600 dark:text-gray-400'
                    )}
                  >
                    English
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                if (currentLocale !== 'ms' && !isLoadingLanguage) {
                  toggleLanguage()
                }
              }}
              disabled={isLoadingLanguage}
              className={cn(
                'flex-1 rounded-lg border-2 p-3 items-center justify-center min-h-[80px]',
                currentLocale === 'ms'
                  ? getActiveBorderClass()
                  : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800'
              )}
            >
              {isLoadingLanguage ? (
                <ActivityIndicator size="small" color={main} />
              ) : (
                <View className="items-center">
                  <Text
                    className={cn(
                      'text-2xl mb-1',
                      currentLocale === 'ms'
                        ? getActiveTextClass()
                        : 'text-gray-700 dark:text-gray-300'
                    )}
                  >
                    🇲🇾
                  </Text>
                  <Text
                    className={cn(
                      'font-medium text-center',
                      currentLocale === 'ms'
                        ? getActiveTextClass()
                        : 'text-gray-600 dark:text-gray-400'
                    )}
                  >
                    Bahasa Malaysia
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* Theme Selector - Web only */}
        {Platform.OS === 'web' && (
          <View>
            <ThemeSelector />
          </View>
        )}

        {/* Color Theme Selector */}
        <View>
          <ColorThemeSelector />
        </View>

        {/* Text Size Selector */}
        <View>
          <TextScaleSelector />
        </View>

        {/* Info & Legal Section */}
        <View className="mt-2">
          <Text className="mb-2 font-bold">
            <Trans>Info & Legal</Trans>
          </Text>
          <View className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* About Us */}
            <Link href="/about" {...(Platform.OS !== 'web' && { asChild: true })}>
              <Pressable className="flex-row items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 active:bg-gray-100 dark:active:bg-gray-800">
                <Text className="text-base">
                  <Trans>About Us</Trans>
                </Text>
                <ChevronRightOutline
                  width={20}
                  height={20}
                  className="text-gray-400"
                />
              </Pressable>
            </Link>
            {/* Contact Us */}
            <Link href="/contact" {...(Platform.OS !== 'web' && { asChild: true })}>
              <Pressable className="flex-row items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 active:bg-gray-100 dark:active:bg-gray-800">
                <Text className="text-base">
                  <Trans>Contact Us</Trans>
                </Text>
                <ChevronRightOutline
                  width={20}
                  height={20}
                  className="text-gray-400"
                />
              </Pressable>
            </Link>
            {/* Privacy Policy */}
            <Link href="/privacy" {...(Platform.OS !== 'web' && { asChild: true })}>
              <Pressable className="flex-row items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 active:bg-gray-100 dark:active:bg-gray-800">
                <Text className="text-base">
                  <Trans>Privacy Policy</Trans>
                </Text>
                <ChevronRightOutline
                  width={20}
                  height={20}
                  className="text-gray-400"
                />
              </Pressable>
            </Link>
            {/* Terms & Conditions */}
            <Link href="/terms" {...(Platform.OS !== 'web' && { asChild: true })}>
              <Pressable className="flex-row items-center justify-between p-3 active:bg-gray-100 dark:active:bg-gray-800">
                <Text className="text-base">
                  <Trans>Terms & Conditions</Trans>
                </Text>
                <ChevronRightOutline
                  width={20}
                  height={20}
                  className="text-gray-400"
                />
              </Pressable>
            </Link>
          </View>
        </View>

        {/* Sign Out */}
        {user && (
          <ButtonIconAndText
            onPress={handleSignOut}
            buttonClassName={
              Platform.OS === 'web'
                ? 'bg-main'
                : colorTheme === 'blue'
                ? 'bg-blue-500'
                : colorTheme === 'purple'
                ? 'bg-purple-500'
                : 'bg-green-600'
            }
            buttonText={currentLocale === 'en' ? 'Sign out' : 'Log keluar'}
            Icon={LogoutOutline}
            iconColorInverted={false}
            isLoading={isLoggingOut}
          />
        )}
      </View>

      {/* Upgrade Modal */}
      <UpgradeModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </ScrollView>
  )
}

export default GeneralTabContent
