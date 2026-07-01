import { Platform } from 'react-native'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ''

// New-style "publishable" key (sb_publishable_…) preferred; legacy anon JWT still supported.
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ''

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY)

let client: SupabaseClient | null = null

/**
 * Lazily create the Supabase client so importing this module never throws at
 * import time when env vars are absent.
 *
 * - web: supabase-js defaults to localStorage + handles the OAuth redirect URL.
 * - native: AsyncStorage persists the session; the URL polyfill is required.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client

  if (!isSupabaseConfigured) {
    throw new Error(
      '[supabase] Not configured. Set EXPO_PUBLIC_SUPABASE_URL/ANON_KEY (native) ' +
        'or NEXT_PUBLIC_SUPABASE_URL/ANON_KEY (web).',
    )
  }

  let storage: any

  if (Platform.OS === 'web') {
    storage = undefined
  } else {
    require('react-native-url-polyfill/auto')
    storage = require('@react-native-async-storage/async-storage').default
  }

  client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
    },
  })

  return client
}
