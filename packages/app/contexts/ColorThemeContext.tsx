import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from 'app/contexts/AuthContext'
import { Platform } from 'react-native'
import { Storage, COLOR_THEME_STORAGE_KEY } from 'app/lib/storage'
import { getUserPrefs, updateUserPrefs } from 'app/lib/prefs'

export type ColorTheme = 'green' | 'blue' | 'purple'

interface ColorThemeContextType {
  colorTheme: ColorTheme
  setColorTheme: (theme: ColorTheme) => Promise<void>
  isLoading: boolean
}

const ColorThemeContext = createContext<ColorThemeContextType>({
  colorTheme: 'green',
  setColorTheme: async () => {},
  isLoading: false,
})

export function ColorThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>('green')
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const { user, isLoading: isAuthLoading } = useAuth()

  // Initialize theme from local storage (optimistic loading)
  useEffect(() => {
    const initializeTheme = async () => {
      try {
        const storedTheme = await Storage.getItem(COLOR_THEME_STORAGE_KEY)
        if (storedTheme === 'green' || storedTheme === 'blue' || storedTheme === 'purple') {
          setColorThemeState(storedTheme)
          // Apply theme to document on web
          if (Platform.OS === 'web' && typeof document !== 'undefined') {
            applyColorThemeToDocument(storedTheme)
          }
        }
      } catch (error) {
        console.warn(
          '[ColorThemeContext] Failed to load theme from local storage:',
          error
        )
      } finally {
        setIsInitialized(true)
      }
    }

    initializeTheme()
  }, [])

  // Apply the active accent to the web <html> whenever it changes.
  // Kept as its own effect so the prefs-sync effect below does NOT depend on
  // `colorTheme` — otherwise every local accent change re-fetches prefs and can
  // revert the selection mid-write.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      applyColorThemeToDocument(colorTheme)
    }
  }, [colorTheme])

  // Load color theme preference from the backend on mount / when user changes
  // (cross-device sync). Local storage stays the optimistic source of truth.
  useEffect(() => {
    const loadColorTheme = async () => {
      // Don't do anything if not initialized yet or if auth is still loading
      if (!isInitialized || isAuthLoading) {
        return
      }

      // If no user after auth loaded, keep the theme from localStorage (don't reset)
      if (!user) {
        return
      }

      try {
        const prefs = await getUserPrefs()
        const savedColorTheme = (prefs as any)?.colorTheme as ColorTheme
        if (savedColorTheme && ['green', 'blue', 'purple'].includes(savedColorTheme)) {
          setColorThemeState(savedColorTheme)

          // Apply theme to document on web
          if (Platform.OS === 'web' && typeof document !== 'undefined') {
            applyColorThemeToDocument(savedColorTheme)
          }

          // Sync to local storage so next refresh is instant
          await Storage.setItem(COLOR_THEME_STORAGE_KEY, savedColorTheme)
        }
        // No valid backend preference: keep the accent already loaded from local
        // storage (it's the optimistic source of truth and is applied to the
        // document by the effect above). Forcing 'green' here would wipe the
        // user's chosen accent on every sign-in.
      } catch (e) {
        console.error(
          '[ColorThemeContext] Failed to load color theme from backend:',
          e
        )
        // On error, also keep the local-storage accent rather than resetting.
      }
    }

    loadColorTheme()
  }, [user, isInitialized, isAuthLoading])

  // Clear local storage when user logs out
  useEffect(() => {
    // Only clear if auth is not loading and user is definitely logged out
    if (!user && isInitialized && !isAuthLoading) {
      // User logged out, clear local storage theme and reset to green
      Storage.removeItem(COLOR_THEME_STORAGE_KEY)
      setColorThemeState('green')
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        applyColorThemeToDocument('green')
      }
    }
  }, [user, isInitialized, isAuthLoading])

  const setColorTheme = async (theme: ColorTheme) => {
    if (theme === colorTheme) return

    setIsLoading(true)

    try {
      // Update local state immediately for better UX
      setColorThemeState(theme)

      // Apply theme to document on web
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        applyColorThemeToDocument(theme)
      }

      // Save to local storage immediately (optimistic persistence)
      await Storage.setItem(COLOR_THEME_STORAGE_KEY, theme)

      // Persist to the backend if signed in (cross-device background sync)
      if (user) {
        await updateUserPrefs({ colorTheme: theme })
      }
    } catch (e) {
      console.error(
        '[ColorThemeContext] Failed to save color theme preference:',
        e
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ColorThemeContext.Provider
      value={{ colorTheme, setColorTheme, isLoading }}
    >
      {children}
    </ColorThemeContext.Provider>
  )
}

export const useColorTheme = () => useContext(ColorThemeContext)

// Helper function to apply color theme to document (web only)
function applyColorThemeToDocument(theme: ColorTheme) {
  if (typeof document === 'undefined') return

  const root = document.documentElement

  // Remove existing theme classes
  root.classList.remove('theme-green', 'theme-blue', 'theme-purple')

  // Add new theme class
  root.classList.add(`theme-${theme}`)
}
