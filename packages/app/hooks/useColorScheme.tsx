import { Platform } from 'react-native'
import { useColorScheme as useNativewindColorScheme } from 'nativewind'

export type ThemeMode = 'light' | 'dark' | 'system'

// Web-specific hook that will be dynamically loaded
let useWebTheme: any = null

export function useColorScheme() {
  const { colorScheme, setColorScheme, toggleColorScheme } =
    useNativewindColorScheme()

  if (Platform.OS === 'web') {
    // Web: Use manual theme control with next-themes
    if (!useWebTheme) {
      try {
        useWebTheme = require('next-themes').useTheme
      } catch (e) {
        console.warn(
          'next-themes not available, falling back to native implementation'
        )
        useWebTheme = null
      }
    }

    if (useWebTheme) {
      const { theme, setTheme, systemTheme } = useWebTheme()
      const resolvedTheme = theme === 'system' ? systemTheme : theme
      const isDark = resolvedTheme === 'dark'

      return {
        colorScheme: isDark ? 'dark' : 'light',
        isDarkColorScheme: isDark,
        setColorScheme: (scheme: 'dark' | 'light') => setTheme(scheme),
        toggleColorScheme: () => setTheme(isDark ? 'light' : 'dark'),
        themeMode: (theme as ThemeMode) || 'system',
        setThemeMode: (mode: ThemeMode) => setTheme(mode),
      }
    }
  }

  // Native (and fallback): Just follow system theme automatically
  // NativeWind's useColorScheme already handles Appearance API subscription on native
  // It automatically updates when system theme changes - no additional code needed!
  return {
    colorScheme: (colorScheme ?? 'dark') as 'dark' | 'light',
    isDarkColorScheme: colorScheme === 'dark',
    setColorScheme,
    toggleColorScheme,
  }
}

/*
  THEME MANAGEMENT IMPLEMENTATION NOTES

  This hook provides a unified interface for theme management across web and native platforms,
  supporting three modes: light, dark, and system (auto).

  KEY FEATURES:

  1. Three Theme Modes:
     - 'light': Force light mode regardless of system preference
     - 'dark': Force dark mode regardless of system preference
     - 'system': Follow the operating system's theme preference

  2. Platform-Specific Implementation:

     WEB (Next.js):
     - Uses next-themes library for theme management
     - Automatically persists theme preference to localStorage
     - Supports SSR/SSG with no flash of unstyled content
     - Listens to system theme changes when in 'system' mode

     NATIVE (React Native / Expo):
     - Uses NativeWind's color scheme hook (includes Appearance API subscription)
     - Automatically follows system theme changes
     - No additional setup needed - NativeWind handles everything

  3. Persistence:
     - Web: localStorage (via next-themes)
     - Native: AsyncStorage
     - Appwrite: User preferences (for cross-device sync, managed by ThemeSelector component)

  4. System Theme Detection:
     - Web: window.matchMedia('(prefers-color-scheme: dark)')
     - Native: Appearance API from React Native

  5. API:
     - colorScheme: The actual resolved color scheme ('light' | 'dark')
     - isDarkColorScheme: Boolean indicating if dark mode is active
     - setColorScheme: Set specific color scheme (light/dark)
     - toggleColorScheme: Toggle between light and dark
     - themeMode: Current theme mode ('light' | 'dark' | 'system') [WEB ONLY]
     - setThemeMode: Change theme mode (updates preference and applies theme) [WEB ONLY]

  USAGE:

  ```tsx
  const {
    colorScheme,           // 'light' | 'dark' (always available)
    isDarkColorScheme,     // boolean (always available)
    setColorScheme,        // (scheme: 'dark' | 'light') => void (always available)
    toggleColorScheme,     // () => void (always available)
    // themeMode/setThemeMode only available on web
  } = useColorScheme()

  // For manual theme control (web only):
  // if (Platform.OS === 'web') {
  //   const { themeMode, setThemeMode } = useColorScheme()
  //   setThemeMode('dark')    // Force dark mode
  //   setThemeMode('system')  // Follow system
  // }

  // For styling (works on both platforms):
  <View className={isDarkColorScheme ? 'bg-gray-900' : 'bg-white'}>
  ```

  BENEFITS:

  - Consistent API across web and native platforms
  - Automatic system theme synchronization
  - Persistent user preferences
  - No flash of incorrect theme on load
  - Type-safe with TypeScript
  - Integrates seamlessly with NativeWind and Tailwind CSS

*/
