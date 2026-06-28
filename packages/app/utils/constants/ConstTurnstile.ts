// Cloudflare Turnstile site key (public - safe to expose)
// Get from: https://dash.cloudflare.com/?to=/:account/turnstile
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
  process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ||
  '0x4AAAAAAB8XPKBL4oJrK2nZ'
