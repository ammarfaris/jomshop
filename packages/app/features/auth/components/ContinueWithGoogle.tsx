import { account } from 'app/provider/appwrite/api'
import { OAuthProvider } from 'app/lib/appwrite-universal'
import { BACKEND } from 'app/lib/backend'
import { getSupabase } from 'app/lib/supabase/client'
import { ButtonIconAndText } from 'app/components/ButtonIconAndText'
import { GoogleSolid } from 'app/components/icons-svg/GoogleSolid'
import { useAuth } from 'app/contexts/AuthContext'
import { downloadAndCacheProfilePicture } from 'app/utils/downloadAndCacheProfilePicture'

/*
  React updates (like showing a spinner) happen on the next render cycle, 
  but window.location.href (used internally by Appwrite to redirect) "short-circuits" that render by navigating away from the current page.

  Unfortunately, you cannot display a loading spinner before a full-page redirect like this unless you’re using a popup-based OAuth flow or managing the auth flow server-side.

  Hence, const [isAuthenticating, setIsAuthenticating] = useState(false) => spinner will not work here
*/
export function ContinueWithGoogle({
  redirectPath = '/', // the redirectPath to return to after auth
}: {
  redirectPath?: string
}) {
  const { refreshUser } = useAuth()

  const signInUpWithGoogleWeb = async () => {
    try {
      if (BACKEND === 'supabase') {
        const origin =
          typeof window !== 'undefined' && window.location?.origin
            ? window.location.origin
            : ''
        // PKCE + detectSessionInUrl handles the code exchange on return.
        const { error } = await getSupabase().auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${origin}${redirectPath}` },
        })
        if (error) throw error
        return true
      }

      // Use the URL that matches your Appwrite platform settings
      // For local development, this should match what's in your Appwrite console

      // Get the current URL to use as base for redirects, or fall back to IP address
      const currentUrl =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'http://192.168.68.56:19000'

      // Encode the redirect path in the URL so we can use it after OAuth completes
      const redirectSuccess = `${currentUrl}${redirectPath}`
      const redirectFailure = `${currentUrl}${redirectPath}`

      // DEBUG
      // console.log(`Using redirect URL: ${redirectSuccess}`)

      account.createOAuth2Session(
        OAuthProvider.Google, // provider
        redirectSuccess,
        redirectFailure
        // ["profile", "email"] (optional)
      )
      return true
    } catch (error) {
      console.error('Authentication error:', error)
      return false
    }
  }

  return (
    <ButtonIconAndText
      onPress={async () => {
        try {
          const success = await signInUpWithGoogleWeb()
          if (success) {
            // [RESOLVED - see note below] attempt to make this work on mobile web on iOS (already working on Android)
            // session seems to be created - but getting the error only for mobile web on iOS => GET /?error=… user_already_exists (Appwrite)
            refreshUser() // not needed but may expedite user refresh on our redirectSuccess page - hence shorter spinner time

            // Download and cache Google profile picture after successful OAuth
            // This runs in background, doesn't block the redirect
            downloadAndCacheProfilePicture().catch((e) =>
              console.log('Could not cache profile picture:', e)
            )

            // The actual redirect happens via OAuth flow to redirectSuccess/redirectFailure URLs
          }
        } catch (e) {
          alert(e)
        }
      }}
      buttonClassName="bg-main"
      buttonText="Continue with Google Web"
      Icon={GoogleSolid}
      iconColorInverted={false}
    />
  )
}

/*
  ## NOTE ON WHY THIS IS NOT WORKING IN MOBILE SAFARI 

  # Why it only happens on mobile Safari
  - Your web app is running at http://192.168.68.60:* while Appwrite lives at https://api.jomcontest.com.
  - After the Google OAuth handshake Appwrite sets an HTTP-only cookie (a_session_*) on *.jomcontest.com to persist the session.
  - iOS Safari (and WebViews) block most third-party cookies by default (“Intelligent Tracking Prevention”). 
  - Because the cookie cannot be saved, Appwrite thinks there’s no session when the callback hits it again, so it tries to create the user and the request crashes with user_already_exists. 
  - Likewise, when a brand-new account is created, the cookie still never makes it back to the browser, so your front-end never sees a logged-in user.

  # Why desktop Chrome / Android work
  - They still allow third-party cookies by default, so the session cookie makes it through and everything works.

  # FIX / WORK-AROUNDS

  1) Same-site domain (recommended)
  - Serve your dev build from a sub-domain of jomcontest.com, e.g. dev.jomcontest.com (or run Appwrite on the same host/IP).
  - Now the session cookie is “first-party” and Safari will keep it.

  2) Token flow (code change, keeps IP dev URLs)
  - Replace account.createOAuth2Session() with the token flow you already use in ContinueWithGoogle.native.tsx
  - NOT SURE THIS WILL WORK FOR WEB GOOGLE AUTH OR NOT - because this involves a new poup or full page

  eg. code
    ```
    const loginUrl = await account.createOAuth2Token(
      OAuthProvider.Google,
      redirectSuccess,
      redirectFailure
    )
    // open loginUrl in a popup or full page
    // after redirect grab ?userId & ?secret and:
    await account.createSession({ userId, secret })
    ```
  - Because you explicitly create the session, you can store the JWT (or keep it in memory) instead of relying on the cookie.

  3) Quick-and-dirty for local testing
  - On the iPhone go to Settings → Safari and temporarily turn OFF “Prevent Cross-Site Tracking” (or use Web Inspector, enable “Allow all cookies”). 
  - Obviously not for production.

*/
