import { useTheme } from 'next-themes'
import { type ThemeMode } from './useColorScheme'

interface UseColorSchemeReturn {
  colorScheme: 'dark' | 'light'
  isDarkColorScheme: boolean
  setColorScheme: (scheme: 'dark' | 'light') => void
  toggleColorScheme: () => void
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
}

export function useColorScheme(): UseColorSchemeReturn {
  // Web implementation using next-themes
  const { theme, setTheme, systemTheme } = useTheme()

  // Determine the actual color scheme being displayed
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
