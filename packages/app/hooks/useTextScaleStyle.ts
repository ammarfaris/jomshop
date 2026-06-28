import { useTextScale } from 'app/contexts/TextScaleContext'
import { Platform, TextStyle } from 'react-native'

/**
 * Hook to get text scale styles for inline styling
 * Use this when you need to apply font sizes via inline styles
 * instead of Tailwind classes
 */
export function useTextScaleStyle() {
  const { fontSize } = useTextScale()

  // For web, we use CSS variables, so return empty styles
  // For native, return the actual font sizes
  if (Platform.OS === 'web') {
    return {
      xs: {} as TextStyle,
      sm: {} as TextStyle,
      base: {} as TextStyle,
      lg: {} as TextStyle,
      xl: {} as TextStyle,
      '2xl': {} as TextStyle,
    }
  }

  return {
    xs: { fontSize: fontSize.xs } as TextStyle,
    sm: { fontSize: fontSize.sm } as TextStyle,
    base: { fontSize: fontSize.base } as TextStyle,
    lg: { fontSize: fontSize.lg } as TextStyle,
    xl: { fontSize: fontSize.xl } as TextStyle,
    '2xl': { fontSize: fontSize['2xl'] } as TextStyle,
  }
}
