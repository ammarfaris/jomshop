import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import { useAuth } from 'app/contexts/AuthContext'
import { downloadAndCacheProfilePicture } from 'app/utils/downloadAndCacheProfilePicture'

/**
 * Hook to handle post-OAuth callback actions
 * Only runs once when user first logs in, not on every page visit
 * Only runs on web - native handles it differently in the OAuth component
 */
export function useOAuthCallback() {
  const { user, isLoading } = useAuth()
  const hasRun = useRef(false)

  useEffect(() => {
    // Skip on native - handled in the OAuth component directly
    if (Platform.OS !== 'web') return

    if (isLoading || !user || hasRun.current) return

    const handleOAuthCallback = async () => {
      try {
        const { account } = await import('app/provider/appwrite/api')

        // Check if profile picture is already cached
        const prefs = await account.getPrefs()
        if ((prefs as any)?.googleProfilePictureData) return

        // Get Google OAuth session
        const sessions = await account.listSessions()
        const googleSession = sessions.sessions.find(
          (session) => session.provider === 'google'
        )

        if (!googleSession?.providerAccessToken) return

        // Check if token is expired
        if (googleSession.providerAccessTokenExpiry) {
          const expiryDate = new Date(googleSession.providerAccessTokenExpiry)
          if (expiryDate < new Date()) return
        }

        // Fetch and cache profile picture
        const response = await fetch(
          `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${googleSession.providerAccessToken}`
        )

        if (response.ok) {
          const userInfo = await response.json()
          if (userInfo.picture) {
            await downloadAndCacheProfilePicture()
          }
        }
      } catch (error) {
        // Silently fail
      }
    }

    // Mark as run to prevent multiple executions
    hasRun.current = true

    // Small delay to ensure session is fully established
    const timer = setTimeout(handleOAuthCallback, 1000)
    return () => clearTimeout(timer)
  }, [user, isLoading])
}
