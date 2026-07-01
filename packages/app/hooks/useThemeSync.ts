import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import { useAuth } from 'app/contexts/AuthContext'
import { getUserPrefs } from 'app/lib/prefs'
import { useColorScheme, ThemeMode } from './useColorScheme'

/**
 * Synchronize the saved theme preference from the user's profile so a theme
 * change on one device is reflected on others when they log in / load the app.
 *
 * Used at the app root (Provider) so the theme loads as soon as the user is
 * authenticated. Loads ONCE per login (no polling) to avoid clobbering local
 * theme changes.
 *
 * NOTE: web only. Native always follows the system theme.
 */
export function useThemeSync() {
  const { user, isLoading } = useAuth()
  const { setThemeMode, themeMode } = useColorScheme()
  const hasLoadedForUserRef = useRef<string | null>(null)

  // setThemeMode is only available on web platforms
  if (!setThemeMode) {
    return
  }

  // Skip on native - native always follows system theme
  if (Platform.OS !== 'web') {
    return
  }

  useEffect(() => {
    // Only sync theme when user is logged in and auth is not loading
    if (isLoading || !user) return

    // Only load once per user (use user ID to track)
    if (hasLoadedForUserRef.current === user.$id) return

    const syncThemeFromBackend = async () => {
      try {
        const prefs = await getUserPrefs()
        const savedTheme = (prefs as any)?.theme as ThemeMode

        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
          // Only update if the saved theme is different from current theme
          if (savedTheme !== themeMode) {
            setThemeMode(savedTheme)
          }
        }

        // Mark as loaded for this user
        hasLoadedForUserRef.current = user.$id
      } catch (error) {
        console.error(
          '[useThemeSync] Failed to sync theme from backend:',
          error
        )
        // Mark as loaded even on error to avoid repeated attempts
        hasLoadedForUserRef.current = user.$id
      }
    }

    syncThemeFromBackend()
  }, [user, isLoading, setThemeMode, themeMode])

  // Reset the loaded flag when user logs out
  useEffect(() => {
    if (!user) {
      hasLoadedForUserRef.current = null
    }
  }, [user])
}
