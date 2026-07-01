import { getSupabase } from 'app/lib/supabase/client'
import { ButtonIconAndText } from 'app/components/ButtonIconAndText'
import { GoogleSolid } from 'app/components/icons-svg/GoogleSolid'
import { useAuth } from 'app/contexts/AuthContext'

/*
  React updates (like showing a spinner) happen on the next render cycle, but the
  full-page OAuth redirect "short-circuits" that render by navigating away from
  the current page, so a loading spinner before the redirect won't show.
*/
export function ContinueWithGoogle({
  redirectPath = '/', // the redirectPath to return to after auth
}: {
  redirectPath?: string
}) {
  const { refreshUser } = useAuth()

  const signInUpWithGoogleWeb = async () => {
    try {
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
            // Expedite the auth-context refresh on the redirect target page.
            refreshUser()
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
