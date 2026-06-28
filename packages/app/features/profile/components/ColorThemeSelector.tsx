'use client'

import { useState } from 'react'
import { View, Pressable, ActivityIndicator, Platform } from 'react-native'
import { Text } from 'app/components/ui/text'
import { cn } from 'app/lib/utils'
import { Trans } from '@lingui/react/macro'
import { useColorTheme, type ColorTheme } from 'app/contexts/ColorThemeContext'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { useColorThemeValues } from 'app/hooks/useColorThemeValues'
import { useSubscription } from 'app/contexts/SubscriptionContext'
import { UpgradeModal } from 'app/features/profile/components/UpgradeModal'
import { LockClosedIcon } from 'app/components/icons-svg/LockClosedIcon'

export function ColorThemeSelector() {
  const { colorTheme, setColorTheme, isLoading } = useColorTheme()
  const { isDarkColorScheme } = useColorScheme()
  const { main } = useColorThemeValues(isDarkColorScheme)
  const { features, isPremium } = useSubscription()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const canChangeColorTheme = features.canChangeColorTheme

  const handleThemeChange = async (theme: ColorTheme) => {
    if (!canChangeColorTheme) {
      setShowUpgradeModal(true)
      return
    }
    if (theme === colorTheme) return
    await setColorTheme(theme)
  }

  // Helper function to get theme-aware border classes for native
  const getActiveBorderClass = (theme: ColorTheme) => {
    if (Platform.OS === 'web') {
      return 'border-main bg-main/10'
    }
    // On native, use hardcoded color classes based on the theme being rendered
    if (theme === 'blue') return 'border-blue-500 bg-blue-500/10'
    if (theme === 'purple') return 'border-purple-500 bg-purple-500/10'
    return 'border-green-600 bg-green-600/10'
  }

  // Helper function to get theme-aware text classes for native
  const getActiveTextClass = (theme: ColorTheme) => {
    if (Platform.OS === 'web') {
      return 'text-main'
    }
    // On native, use hardcoded color classes based on the theme being rendered
    if (theme === 'blue') return 'text-blue-500'
    if (theme === 'purple') return 'text-purple-500'
    return 'text-green-600'
  }

  const themes: Array<{
    theme: ColorTheme
    label: string
    emoji: string
    description: string
  }> = [
    {
      theme: 'green',
      label: 'Green',
      emoji: '🟢',
      description: 'Fresh & Natural',
    },
    {
      theme: 'blue',
      label: 'Blue',
      emoji: '🔵',
      description: 'Cool & Professional',
    },
    {
      theme: 'purple',
      label: 'Purple',
      emoji: '🟣',
      description: 'Creative & Vibrant',
    },
  ]

  return (
    <View>
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2">
          <Text className="font-bold">
            <Trans>Color Theme</Trans>
          </Text>
          {!canChangeColorTheme && (
            <View className="flex-row items-center gap-1 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
              <LockClosedIcon
                width={12}
                height={12}
                className="text-amber-600 dark:text-amber-400"
              />
              <Text className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                <Trans>Plus</Trans>
              </Text>
            </View>
          )}
        </View>
      </View>

      {!canChangeColorTheme && (
        <Pressable
          onPress={() => setShowUpgradeModal(true)}
          className="mb-2 p-3 rounded-lg bg-gradient-to-r from-amber-50 to-purple-50 dark:from-amber-900/20 dark:to-purple-900/20 border border-amber-200 dark:border-amber-800"
        >
          <Text className="text-sm text-center text-gray-600 dark:text-gray-400">
            <Trans>Upgrade to Plus or Pro to unlock custom color themes</Trans>{' '}
            ✨
          </Text>
        </Pressable>
      )}

      <View
        className={cn('flex-row gap-2', !canChangeColorTheme && 'opacity-60')}
      >
        {themes.map(({ theme, label, emoji, description }) => {
          const isActive = colorTheme === theme
          // For free users, only green is "active" and others are locked
          const isLocked = !canChangeColorTheme && theme !== 'green'

          return (
            <Pressable
              key={theme}
              onPress={() => handleThemeChange(theme)}
              disabled={isLoading}
              className={cn(
                'flex-1 rounded-lg border-2 p-3 items-center justify-center min-h-[100px]',
                isActive
                  ? getActiveBorderClass(theme)
                  : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800'
              )}
            >
              {isLoading && isActive ? (
                <ActivityIndicator size="small" color={main} />
              ) : (
                <View className="items-center">
                  {isLocked && (
                    <View className="absolute top-1 right-1">
                      <LockClosedIcon
                        width={14}
                        height={14}
                        className="text-gray-400"
                      />
                    </View>
                  )}
                  <Text
                    className={cn(
                      'text-3xl mb-1',
                      isActive
                        ? getActiveTextClass(theme)
                        : 'text-gray-700 dark:text-gray-300'
                    )}
                  >
                    {emoji}
                  </Text>
                  <Text
                    className={cn(
                      'font-semibold text-center mb-0.5',
                      isActive
                        ? getActiveTextClass(theme)
                        : 'text-gray-600 dark:text-gray-400'
                    )}
                  >
                    {label === 'Green' && <Trans>Green</Trans>}
                    {label === 'Blue' && <Trans>Blue</Trans>}
                    {label === 'Purple' && <Trans>Purple</Trans>}
                  </Text>
                  <Text
                    className={cn(
                      'text-xs text-center',
                      isActive
                        ? getActiveTextClass(theme)
                        : 'text-gray-500 dark:text-gray-500'
                    )}
                  >
                    {description === 'Fresh & Natural' && (
                      <Trans>Fresh & Natural</Trans>
                    )}
                    {description === 'Cool & Professional' && (
                      <Trans>Cool & Professional</Trans>
                    )}
                    {description === 'Creative & Vibrant' && (
                      <Trans>Creative & Vibrant</Trans>
                    )}
                  </Text>
                </View>
              )}
            </Pressable>
          )
        })}
      </View>

      <UpgradeModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        featureName="Color Themes"
      />
    </View>
  )
}
