import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import { OAuthProvider } from 'app/lib/appwrite-universal'
import { useRouter } from 'app/lib/router-universal'

import { account } from 'app/provider/appwrite/api'
import { BACKEND } from 'app/lib/backend'
import { getSupabase } from 'app/lib/supabase/client'
import { ButtonIconAndText } from 'app/components/ButtonIconAndText'
import { GoogleSolid } from 'app/components/icons-svg/GoogleSolid'
import { useAuth } from 'app/contexts/AuthContext'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { useColorThemeValues } from 'app/hooks/useColorThemeValues'

export function ContinueWithGoogle({
  redirectPath = '/', // this redirectPath will be used to redirect upon success or failure
}: {
  redirectPath?: string
}) {
  const { isDarkColorScheme } = useColorScheme()
  const { main } = useColorThemeValues(isDarkColorScheme)
  const router = useRouter()
  const { refreshUser } = useAuth()

  const signInUpWithGoogleMobile = async () => {
    try {
      if (BACKEND === 'supabase') {
        // Dev/standalone builds resolve to the app scheme
        // (jomshop://auth-callback); Expo Go resolves to an exp:// URL with the
        // current LAN IP. Whichever it logs MUST be added to Supabase Auth →
        // URL Configuration → Redirect URLs, otherwise Supabase ignores it and
        // falls back to the project's Site URL (the localhost:3000 default).
        const redirectTo = makeRedirectUri({
          scheme: 'jomshop',
          path: 'auth-callback',
        })
        console.log('[Native Auth][Supabase] redirectTo:', redirectTo)
        // Supabase auth rejects redirect URLs that contain a raw IP address
        // (supabase/auth#2039) regardless of the allow-list, and silently falls
        // back to the Site URL (localhost). Expo Go produces exp://<LAN-IP>:...,
        // which triggers this. Use a dev build (jomshop://auth-callback) or run
        // `expo start --tunnel` so the redirect is host-based instead.
        if (/\/\/(\d{1,3}\.){3}\d{1,3}/.test(redirectTo)) {
          console.warn(
            '[Native Auth][Supabase] redirectTo contains a LAN IP — Supabase ' +
              'will ignore it and fall back to the Site URL (localhost). ' +
              'Use a dev build (jomshop://) or run Expo with --tunnel.',
          )
        }
        const { data, error } = await getSupabase().auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, skipBrowserRedirect: true },
        })
        if (error || !data?.url) {
          console.warn('[Native Auth][Supabase] signInWithOAuth error:', error)
          return false
        }

        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo,
        )
        if (result.type === 'success' && result.url) {
          const code = new URL(result.url).searchParams.get('code')
          if (code) {
            const { error: exErr } =
              await getSupabase().auth.exchangeCodeForSession(code)
            if (exErr) return false
            await refreshUser()
            return true
          }
        }
        return false
      }

      // NOTE: We no longer delete the existing session first
      // This was causing race conditions and session loss on Android
      // Appwrite will handle existing sessions automatically

      // Create a deep link that works across Expo environments
      // Ensure localhost is used for the hostname to validation error for success/failure URLs
      const deepLink = new URL(makeRedirectUri({ preferLocalhost: true }))
      if (!deepLink.hostname) {
        deepLink.hostname = 'localhost'
      }
      const scheme = `${deepLink.protocol}//` // e.g. 'exp://' or 'playground://'

      // added, follow pattern from previous app
      const deepLink2 = 'exp://192.168.68.58:19001' // we have two separate session for mobile and web, hence our port number will be either 19001 or 19000 during development

      console.log('[Native Auth] Starting OAuth flow...')

      // Start OAuth flow
      const loginUrl = await account.createOAuth2Token(
        OAuthProvider.Google,
        `${deepLink2}`, // previously deepLink
        `${deepLink2}`, // previously deepLink
      )

      // Open loginUrl and listen for the scheme redirect
      const result = await WebBrowser.openAuthSessionAsync(
        `${loginUrl}`,
        scheme,
      )

      console.log('[Native Auth] OAuth result:', result.type)

      // Extract credentials from OAuth redirect URL if successful
      if (result.type === 'success' && result.url) {
        const url = new URL(result.url)
        const secret = url.searchParams.get('secret')
        const userId = url.searchParams.get('userId')

        // Ensure userId and secret are not null before creating session
        if (userId && secret) {
          console.log('[Native Auth] Creating session for userId:', userId)

          // Create the session
          await account.createSession({ userId, secret })

          console.log(
            '[Native Auth] Session created, waiting for AsyncStorage to persist...',
          )

          // CRITICAL: Add delay to ensure AsyncStorage has time to persist the session
          // This is especially important on Android where AsyncStorage writes can be slower
          await new Promise((resolve) => setTimeout(resolve, 500))

          console.log('[Native Auth] Verifying session...')

          // Verify the session was actually created and persisted
          try {
            const user = await account.get()
            console.log('[Native Auth] Session verified for user:', user.$id)
          } catch (e) {
            console.error('[Native Auth] Session verification failed:', e)
            return false
          }

          // Refresh the auth context - THIS IS CRUCIAL for our new OAuth session to be reflected and changed page status to "logged-in page"
          await refreshUser()

          console.log('[Native Auth] Auth context refreshed')

          // Note: Appwrite's native OAuth (createOAuth2Token) does not provide
          // the Google access token in the session, so we cannot fetch the profile picture.
          // Native users will see initials fallback instead.
          // Confirmed: session.providerAccessToken is empty on native.
          // See: docs/NATIVE_PROFILE_PICTURE_LIMITATION.md

          return true
        } else {
          console.warn(
            '[Native Auth] Missing userId or secret in OAuth redirect URL',
          )
          return false
        }
      } else {
        // Handle cancel or error
        console.warn(
          '[Native Auth] Authentication was not successful:',
          result.type,
        )
        return false
      }
    } catch (error) {
      console.error('[Native Auth] Authentication error:', error)
      return false
    }
  }

  return (
    <ButtonIconAndText
      onPress={async () => {
        try {
          await signInUpWithGoogleMobile()
          // Redirect to the specified path regardless of success or failure
          router.push(redirectPath)
        } catch (e) {
          alert(e)
          // Still redirect even on error
          router.push(redirectPath)
        }
      }}
      buttonStyle={{ backgroundColor: main }}
      buttonText="Continue with Google"
      Icon={GoogleSolid}
      iconColorInverted={false}
    />
  )
}
