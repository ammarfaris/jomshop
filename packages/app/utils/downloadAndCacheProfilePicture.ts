import { account } from 'app/provider/appwrite/api'

interface GoogleUserInfo {
  picture?: string
}

/**
 * Downloads the Google profile picture and converts it to a data URL
 * This avoids CORS and rate limiting issues
 */
async function downloadImageAsDataUrl(
  imageUrl: string
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) return null

    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    return null
  }
}

/**
 * Fetches Google profile picture and caches it as a data URL in preferences
 * This avoids CORS/rate limiting issues with Google's CDN
 *
 * Note: On native platforms, the OAuth token flow doesn't preserve the Google access token,
 * so this function will only work on web or immediately after OAuth on native.
 */
export async function downloadAndCacheProfilePicture(): Promise<string | null> {
  try {
    // Check if already cached
    const prefs = await account.getPrefs()
    if ((prefs as any)?.googleProfilePictureData) {
      return (prefs as any).googleProfilePictureData
    }

    // Get sessions to find Google OAuth session
    const sessions = await account.listSessions()
    const googleSessions = sessions.sessions
      .filter(
        (session) =>
          session.provider === 'google' ||
          (session.provider === 'oauth2' && session.providerUid)
      )
      .sort(
        (a, b) =>
          new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime()
      )

    const googleSession = googleSessions[0]
    if (!googleSession?.providerAccessToken) return null

    // Check if token is expired
    if (googleSession.providerAccessTokenExpiry) {
      const expiryDate = new Date(googleSession.providerAccessTokenExpiry)
      if (expiryDate < new Date()) return null
    }

    // Fetch user info from Google API
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${googleSession.providerAccessToken}`
    )

    if (!response.ok) return null

    const userInfo: GoogleUserInfo = await response.json()
    if (!userInfo.picture) return null

    // Download the image and convert to data URL
    const dataUrl = await downloadImageAsDataUrl(userInfo.picture)
    if (!dataUrl) return null

    // Cache both the original URL and the data URL
    try {
      const currentPrefs = await account.getPrefs()
      await account.updatePrefs({
        ...currentPrefs,
        googleProfilePicture: userInfo.picture,
        googleProfilePictureData: dataUrl,
      })
      return dataUrl
    } catch (e) {
      return dataUrl // Return the data URL even if caching failed
    }
  } catch (error) {
    return null
  }
}
