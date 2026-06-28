import { useState, useEffect } from 'react'
import { account } from 'app/provider/appwrite/api'

interface GoogleUserInfo {
  picture?: string
}

/**
 * Hook to fetch Google profile picture using OAuth access token
 * Caches the picture in Appwrite preferences to avoid repeated API calls
 * Falls back to null if fetch fails
 */
export function useGoogleProfilePicture(userId?: string) {
  const [profilePicture, setProfilePicture] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    const fetchGoogleProfilePicture = async () => {
      try {
        setIsLoading(true)

        // Check if profile picture is already cached in preferences
        try {
          const prefs = await account.getPrefs()
          // Prefer data URL (avoids CORS issues) over regular URL
          if ((prefs as any)?.googleProfilePictureData) {
            setProfilePicture((prefs as any).googleProfilePictureData)
            setIsLoading(false)
            return
          }
          if ((prefs as any)?.googleProfilePicture) {
            setProfilePicture((prefs as any).googleProfilePicture)
            setIsLoading(false)
            return
          }
        } catch (e) {
          // Silently fail - user not logged in or preferences unavailable
        }

        // Try to fetch fresh profile picture from Google
        const sessions = await account.listSessions()
        const googleSession = sessions.sessions.find(
          (session) => session.provider === 'google'
        )

        if (!googleSession?.providerAccessToken) {
          setProfilePicture(null)
          return
        }

        // Check if token is expired
        if (googleSession.providerAccessTokenExpiry) {
          const expiryDate = new Date(googleSession.providerAccessTokenExpiry)
          if (expiryDate < new Date()) {
            setProfilePicture(null)
            return
          }
        }

        // Fetch user info from Google API
        const response = await fetch(
          `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${googleSession.providerAccessToken}`
        )

        if (!response.ok) {
          setProfilePicture(null)
          return
        }

        const userInfo: GoogleUserInfo = await response.json()

        if (userInfo.picture) {
          setProfilePicture(userInfo.picture)

          // Cache the profile picture in preferences for future use
          try {
            const currentPrefs = await account.getPrefs()
            await account.updatePrefs({
              ...currentPrefs,
              googleProfilePicture: userInfo.picture,
            })
          } catch (e) {
            // Silently fail - caching is optional
          }
        } else {
          setProfilePicture(null)
        }
      } catch (error) {
        setProfilePicture(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchGoogleProfilePicture()
  }, [userId])

  return { profilePicture, isLoading }
}
