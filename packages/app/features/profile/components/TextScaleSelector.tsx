import { View, Pressable, ActivityIndicator, Platform } from 'react-native'
import { Text } from 'app/components/ui/text'
import { Trans } from '@lingui/react/macro'
import { useTextScale, type TextScale } from 'app/contexts/TextScaleContext'
import { useColorThemeValues } from 'app/hooks/useColorThemeValues'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { useColorTheme } from 'app/contexts/ColorThemeContext'
import { cn } from 'app/lib/utils'

export function TextScaleSelector() {
  const { textScale, setTextScale, isLoading } = useTextScale()
  const { isDarkColorScheme } = useColorScheme()
  const { colorTheme } = useColorTheme()
  const themeColors = useColorThemeValues(isDarkColorScheme)
  const { main } = themeColors
  
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

  const handleScaleChange = async (scale: TextScale) => {
    await setTextScale(scale)
  }

  const scales: {
    value: TextScale
    label: React.ReactNode
    baseSize: number
  }[] = [
    {
      value: 'smaller',
      label: <Trans>Smaller</Trans>,
      baseSize: 14,
    },
    {
      value: 'regular',
      label: <Trans>Regular</Trans>,
      baseSize: 16,
    },
    {
      value: 'bigger',
      label: <Trans>Bigger</Trans>,
      baseSize: 18,
    },
  ]

  return (
    <View>
      <Text className="mb-2 font-bold">
        <Trans>Text Size</Trans>
      </Text>
      <View className="flex-row gap-2">
        {scales.map((scale) => {
          // Determine if this is the current scale to show preview
          const isCurrentScale = textScale === scale.value

          return (
            <Pressable
              key={scale.value}
              onPress={() => handleScaleChange(scale.value)}
              disabled={isLoading}
              className={cn(
                'flex-1 rounded-lg border-2 p-3 items-center justify-center min-h-[80px]',
                isCurrentScale
                  ? getActiveBorderClass()
                  : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800'
              )}
            >
              {isLoading ? (
                <ActivityIndicator
                  size="small"
                  color={main}
                />
              ) : (
                <View className="items-center">
                  {/* Preview text with actual size - "Aa" */}
                  <Text
                    className={cn(
                      'font-bold mb-1 text-center',
                      // Add preview class for web FIRST (for font size)
                      Platform.OS === 'web' &&
                        `text-scale-preview-${scale.value}`,
                      // Then add color class LAST (higher specificity)
                      isCurrentScale
                        ? 'text-main'
                        : 'text-gray-700 dark:text-gray-300'
                    )}
                    style={
                      Platform.OS === 'web'
                        ? undefined
                        : {
                            fontSize: scale.baseSize,
                            ...(isCurrentScale
                              ? { color: themeColors.main }
                              : undefined),
                          }
                    }
                  >
                    Aa
                  </Text>
                  {/* Label with actual size */}
                  <Text
                    className={cn(
                      'font-medium text-center',
                      // Add preview class for web FIRST (for font size)
                      Platform.OS === 'web' &&
                        `text-scale-preview-${scale.value}`,
                      // Then add color class LAST (higher specificity)
                      isCurrentScale
                        ? 'text-main'
                        : 'text-gray-600 dark:text-gray-400'
                    )}
                    style={
                      Platform.OS === 'web'
                        ? undefined
                        : {
                            fontSize: scale.baseSize,
                            ...(isCurrentScale
                              ? { color: themeColors.main }
                              : undefined),
                          }
                    }
                  >
                    {scale.label}
                  </Text>
                </View>
              )}
            </Pressable>
          )
        })}
      </View>
      <Text className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        <Trans>
          Adjust text size for better readability. Changes apply across the app.
        </Trans>
      </Text>
    </View>
  )
}
