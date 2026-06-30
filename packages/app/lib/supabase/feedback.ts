import { getSupabase } from './client'

/**
 * Insert a feedback row for the current user. RLS enforces user_id = auth.uid().
 *
 * NOTE: The Appwrite path ran CAPTCHA verification + dedup server-side (an
 * Appwrite Function). Here the row is inserted directly; the Turnstile token is
 * still collected client-side but not yet verified server-side. Server-side
 * verification belongs to the later Edge Function hardening pass.
 */
export async function submitFeedbackSupabase(
  message: string,
  pageUrl: string,
): Promise<void> {
  const supabase = getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  const { error } = await supabase.from('feedback').insert({
    user_id: user.id,
    message,
    page_url: pageUrl || null,
    user_name:
      (user.user_metadata?.full_name as string | undefined) ?? null,
    user_email: user.email ?? null,
  })

  if (error) throw error
}
