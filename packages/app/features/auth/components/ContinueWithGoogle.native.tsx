import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import { useRouter } from 'app/lib/router-universal'

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

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
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
