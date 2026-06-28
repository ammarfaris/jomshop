'use client'

import { View, Pressable, ActivityIndicator } from 'react-native'
import { Text } from 'app/components/ui/text'
import { cn } from 'app/lib/utils'
import { Trans } from '@lingui/react/macro'
import { useState, useEffect } from 'react'
import { account } from 'app/provider/appwrite/api'
import { useAuth } from 'app/contexts/AuthContext'
import { useTheme } from 'next-themes'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { useColorThemeValues } from 'app/hooks/useColorThemeValues'

export type ThemeMode = 'light' | 'dark' | 'system'

export function ThemeSelector() {
  // Use next-themes directly on web
  const { theme, setTheme } = useTheme()
  const currentThemeMode = (theme || 'system') as ThemeMode

  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [loadingTheme, setLoadingTheme] = useState<ThemeMode | null>(null)

  const { isDarkColorScheme } = useColorScheme()
  const { main } = useColorThemeValues(isDarkColorScheme)

  // Load theme preference from Appwrite on mount
  useEffect(() => {
    const loadThemeFromAppwrite = async () => {
      if (!user) return

      try {
        const prefs = await account.getPrefs()
        const savedTheme = (prefs as any)?.theme as ThemeMode
        if (
          savedTheme &&
          ['light', 'dark', 'system'].includes(savedTheme) &&
          savedTheme !== currentThemeMode
        ) {
          setTheme(savedTheme)
        }
      } catch (e) {
        console.error('Failed to load theme from Appwrite:', e)
      }
    }

    loadThemeFromAppwrite()
  }, [user])

  const handleThemeChange = async (mode: ThemeMode) => {
    if (mode === currentThemeMode) {
      return
    }

    setIsLoading(true)
    setLoadingTheme(mode)

    try {
      // Update local theme immediately for better UX
      setTheme(mode)

      // Save to Appwrite preferences if user is logged in
      if (user) {
        const currentPrefs = await account.getPrefs()
        await account.updatePrefs({ ...currentPrefs, theme: mode })
      }
    } catch (e) {
      console.error('Failed to save theme preference:', e)
    } finally {
      setIsLoading(false)
      setLoadingTheme(null)
    }
  }

  const themes: Array<{
    mode: ThemeMode
    label: string
    emoji: string
  }> = [
    {
      mode: 'light',
      label: 'Light',
      emoji: '☀️',
    },
    {
      mode: 'dark',
      label: 'Dark',
      emoji: '🌙',
    },
    {
      mode: 'system',
      label: 'System',
      emoji: '💻',
    },
  ]

  return (
    <View>
      <Text className="mb-2 font-bold">
        <Trans>Theme</Trans>
      </Text>
      <View className="flex-row gap-2">
        {themes.map(({ mode, label, emoji }) => {
          const isActive = currentThemeMode === mode
          const isLoadingThis = loadingTheme === mode

          return (
            <Pressable
              key={mode}
              onPress={() => handleThemeChange(mode)}
              disabled={isLoading}
              className={cn(
                'flex-1 rounded-lg border-2 p-3 items-center justify-center min-h-[80px]',
                isActive
                  ? 'border-main bg-main/10'
                  : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800'
              )}
            >
              {isLoadingThis ? (
                <ActivityIndicator size="small" color={main} />
              ) : (
                <View className="items-center">
                  <Text
                    className={cn(
                      'text-2xl mb-1',
                      isActive
                        ? 'text-main'
                        : 'text-gray-700 dark:text-gray-300'
                    )}
                  >
                    {emoji}
                  </Text>
                  <Text
                    className={cn(
                      'font-medium text-center',
                      isActive
                        ? 'text-main'
                        : 'text-gray-600 dark:text-gray-400'
                    )}
                  >
                    {label === 'Light' && <Trans>Light</Trans>}
                    {label === 'Dark' && <Trans>Dark</Trans>}
                    {label === 'System' && <Trans>System</Trans>}
                  </Text>
                </View>
              )}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
