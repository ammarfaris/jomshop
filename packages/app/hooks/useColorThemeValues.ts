import { useColorTheme } from 'app/contexts/ColorThemeContext'
import { Platform } from 'react-native'

// Color theme values for green, blue, and purple themes
const COLOR_THEMES = {
  green: {
    light: {
      main: 'hsl(142.1, 76.2%, 36.3%)',
      mainForeground: 'hsl(355.7, 100%, 97.3%)',
    },
    dark: {
      main: 'hsl(142.1, 70.6%, 45.3%)',
      mainForeground: 'hsl(144.9, 80.4%, 10%)',
    },
  },
  blue: {
    light: {
      main: 'hsl(217.2, 91.2%, 59.8%)',
      mainForeground: 'hsl(222.2, 47.4%, 11.2%)',
    },
    dark: {
      main: 'hsl(217.2, 91.2%, 59.8%)',
      mainForeground: 'hsl(222.2, 47.4%, 11.2%)',
    },
  },
  purple: {
    light: {
      main: 'hsl(270, 91%, 65%)',
      mainForeground: 'hsl(355.7, 100%, 97.3%)',
    },
    dark: {
      main: 'hsl(270, 91%, 65%)',
      mainForeground: 'hsl(270, 100%, 95%)',
    },
  },
}

/**
 * Hook to get the current color theme values
 * On web, this returns CSS variable references
 * On native, this returns actual color values
 */
export function useColorThemeValues(isDark: boolean = false) {
  const { colorTheme } = useColorTheme()

  if (Platform.OS === 'web') {
    // On web, use CSS variables
    return {
      main: 'hsl(var(--main))',
      mainForeground: 'hsl(var(--main-foreground))',
    }
  }

  // On native, return actual color values
  // Fallback to green if colorTheme is undefined or invalid
  const safeColorTheme = colorTheme && COLOR_THEMES[colorTheme] ? colorTheme : 'green'
  const theme = isDark ? COLOR_THEMES[safeColorTheme].dark : COLOR_THEMES[safeColorTheme].light
  return theme
}

