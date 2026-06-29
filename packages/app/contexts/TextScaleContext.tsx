import { createContext, useContext, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { account } from 'app/provider/appwrite/api'
import { useAuth } from './AuthContext'
import { BACKEND } from 'app/lib/backend'

export type TextScale = 'smaller' | 'regular' | 'bigger'

interface TextScaleContextType {
  textScale: TextScale
  setTextScale: (scale: TextScale) => Promise<void>
  isLoading: boolean
  // Font size helpers (in px)
  fontSize: {
    xs: number // Extra small
    sm: number // Small
    base: number // Base/body text
    lg: number // Large
    xl: number // Extra large
    '2xl': number // 2x large
  }
}

// Base font sizes for each scale (in px)
// NOTE: Smaller scale uses 14px base which may trigger iOS Safari zoom on some inputs
// Consider this trade-off: smaller text vs potential zoom behavior
const FONT_SCALES = {
  smaller: {
    xs: 11,
    sm: 12,
    base: 14, // Compact size (may trigger iOS zoom)
    lg: 16,
    xl: 18,
    '2xl': 22,
  },
  regular: {
    xs: 12,
    sm: 14,
    base: 16, // Safe size (>= 16px prevents iOS zoom)
    lg: 18,
    xl: 20,
    '2xl': 24,
  },
  bigger: {
    xs: 13,
    sm: 15,
    base: 18, // Larger base
    lg: 20,
    xl: 22,
    '2xl': 26,
  },
}

const TextScaleContext = createContext<TextScaleContextType>({
  textScale: 'regular',
  setTextScale: async () => {},
  isLoading: true,
  fontSize: FONT_SCALES.regular,
})

export function TextScaleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [textScale, setTextScaleState] = useState<TextScale>('regular')
  const [isLoading, setIsLoading] = useState(true)

  // Load text scale preference from Appwrite user preferences
  useEffect(() => {
    const fetchTextScalePreference = async () => {
      setIsLoading(true)
      try {
        if (BACKEND !== 'appwrite') {
          // Supabase spike has no preferences table yet; use the local default.
          setTextScaleState('regular')
        } else if (user) {
          const prefs = await account.getPrefs()
          const scale = (prefs as any)?.textScale || 'regular'
          if (['smaller', 'regular', 'bigger'].includes(scale)) {
            setTextScaleState(scale as TextScale)
          } else {
            setTextScaleState('regular')
          }
        } else {
          // If not logged in, use default
          setTextScaleState('regular')
        }
      } catch {
        setTextScaleState('regular')
      } finally {
        setIsLoading(false)
      }
    }
    fetchTextScalePreference()
  }, [user])

  // Update text scale preference
  const setTextScale = async (scale: TextScale) => {
    // Update state first
    setTextScaleState(scale)

    // Apply to document root for web
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-text-scale', scale)
    }

    // Save preference to Appwrite
    try {
      if (BACKEND === 'appwrite' && user) {
        const currentPrefs = await account.getPrefs()
        await account.updatePrefs({ ...currentPrefs, textScale: scale })
      }
    } catch (error) {
      console.error('Failed to save text scale preference:', error)
    }
  }

  // Apply initial scale to document root on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-text-scale', textScale)
    }
  }, [textScale])

  return (
    <TextScaleContext.Provider
      value={{
        textScale,
        setTextScale,
        isLoading,
        fontSize: FONT_SCALES[textScale],
      }}
    >
      {children}
    </TextScaleContext.Provider>
  )
}

export const useTextScale = () => useContext(TextScaleContext)
