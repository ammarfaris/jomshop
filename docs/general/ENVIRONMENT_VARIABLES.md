# Environment Variables Configuration

This document describes all environment variables used in the JomContest
application. JomContest runs on **Supabase** (Auth, Postgres + RLS, Storage,
Edge Functions), with Cloudflare Turnstile for CAPTCHA.

## Overview

Configuration is split across three places:

1. **Next.js web app** (`apps/next`) — `NEXT_PUBLIC_*` client vars + a couple of
   server-only vars.
2. **Expo mobile app** (`apps/expo`) — `EXPO_PUBLIC_*` client vars.
3. **Supabase Edge Function secrets** — server-only secrets set with the Supabase
   CLI (never shipped in the client bundle).

The shared Supabase client (`packages/app/lib/supabase/client.ts`) reads the
Supabase URL/key from either the `EXPO_PUBLIC_*` or `NEXT_PUBLIC_*` variables, so
the same code works on web and native.

> **Key naming:** Supabase's new **publishable** key (`sb_publishable_…`) is
> preferred and is safe to expose in the client bundle. The legacy `…_ANON_KEY`
> (anon JWT) is still accepted as a fallback.

---

## Next.js Web App (`apps/next`)

### Configuration Files

- `.env` / `.env.local` — local development (gitignored)
- `.env.example` — template committed to the repo
- Production values are configured in the hosting provider (e.g. Vercel)

### Required Variables

#### `NEXT_PUBLIC_SUPABASE_URL`

- **Purpose**: Base URL of the Supabase project (Auth, Postgres/PostgREST,
  Storage, Edge Functions).
- **Type**: Public (safe in the browser bundle).
- **Example**: `https://abdaylmwkcmxmsvagfch.supabase.co`

#### `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

- **Purpose**: Supabase publishable API key used by the browser client. RLS
  policies enforce per-user access, so this key is safe to expose.
- **Type**: Public.
- **Format**: `sb_publishable_…`
- **Legacy fallback**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon JWT) is still
  accepted if the publishable key is not set.
- **Where to get it**: Supabase Dashboard → Project Settings → API Keys.

#### `NEXT_PUBLIC_BASE_URL`

- **Purpose**: Base URL of the web app, used for metadata and share URLs.
- **Type**: Public.
- **Usage**: Open Graph / Twitter Card metadata, canonical URLs, and share URL
  generation (fallback when `window.location.origin` is unavailable).
- **Examples**:
  - Development: `http://localhost:19000`
  - Production: `https://jomcontest.com`

### Server-Only Variables

#### `MAINTENANCE_MODE`

- **Purpose**: Maintenance switch evaluated server-side. When `true`, all pages
  rewrite to `/maintenance`; when `false`, the app behaves normally.
- **Type**: Private (server-side only — **no** `NEXT_PUBLIC_` prefix).
- **Values**: `true` | `false`

### Optional Variables

#### `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

- **Purpose**: Cloudflare Turnstile **site** key for the CAPTCHA widget.
- **Type**: Public (site keys are meant to be public).
- **Notes**: Read via `packages/app/utils/constants/ConstTurnstile.ts`, which
  falls back to a built-in default site key if unset. The matching **secret** key
  lives only in the Edge Function (see below).

#### `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID`

- **Purpose**: Google AdSense publisher ID used in `apps/next/app/layout.tsx`.
- **Type**: Public.
- **Notes**: Falls back to a built-in default if unset.

---

## Expo Mobile App (`apps/expo`)

### Configuration Files

- `.env` — environment variables (gitignored)
- `.env.example` — template committed to the repo
- Production/build values can be set in `eas.json` or as EAS secrets.

### Required Variables

#### `EXPO_PUBLIC_SUPABASE_URL`

- **Purpose**: Supabase project URL (same value as the web app).
- **Type**: Public.
- **Example**: `https://abdaylmwkcmxmsvagfch.supabase.co`

#### `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

- **Purpose**: Supabase publishable API key for the native client.
- **Type**: Public.
- **Format**: `sb_publishable_…`
- **Legacy fallback**: `EXPO_PUBLIC_SUPABASE_ANON_KEY` is still accepted.

### Optional Variables

#### `EXPO_PUBLIC_TURNSTILE_SITE_KEY`

- **Purpose**: Cloudflare Turnstile site key for the CAPTCHA widget on native
  (rendered in a WebView). Same fallback behavior as the web key.

> **RevenueCat (subscriptions):** RevenueCat is integrated in code but the SDK
> API key is **not** currently supplied via an environment variable (native
> purchases are stubbed pending custom dev builds, and the web SDK key is passed
> in at `configure(apiKey, userId)` time). When wiring RevenueCat for production,
> add its public SDK key here (e.g. `EXPO_PUBLIC_REVENUECAT_API_KEY`) and pass it
> to the subscription service.

---

## Supabase Edge Function Secrets

Edge Functions live in `supabase/functions/` (Deno). Secrets are configured with
the Supabase CLI and are only available server-side inside the function runtime.

```bash
supabase secrets set TURNSTILE_SECRET_KEY=your-cloudflare-turnstile-secret
```

| Secret | Purpose |
| ------ | ------- |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile **secret** key. The `receipts` Edge Function verifies CAPTCHA tokens against `https://challenges.cloudflare.com/turnstile/v0/siteverify`. Never expose this in the client. |
| `SUPABASE_URL` | Injected automatically by the Supabase runtime. |
| `SUPABASE_ANON_KEY` | Injected automatically. Used to act on behalf of the calling user (respecting RLS). |
| `SUPABASE_SERVICE_ROLE_KEY` | Injected automatically. Used for privileged, un-bypassable writes (e.g. inserting receipt rows the client is not allowed to insert directly). **Never** expose this key anywhere client-side. |

---

## Setup Instructions

### Local Development

1. **Next.js Web App**:

   ```bash
   cd apps/next
   cp .env.example .env.local
   # Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   ```

2. **Expo Mobile App**:

   ```bash
   cd apps/expo
   cp .env.example .env
   # Fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   ```

3. **Start development servers** (from the repo root):

   ```bash
   yarn web    # Next.js  (http://localhost:19000)
   yarn native # Expo     (http://localhost:19001)
   ```

### Production Deployment

#### Vercel (Next.js)

1. Dashboard → Project → Settings → Environment Variables.
2. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `NEXT_PUBLIC_BASE_URL`, and `MAINTENANCE_MODE` (plus optional Turnstile /
   AdSense keys).
3. Redeploy.

#### Expo EAS (Mobile)

Configure the `EXPO_PUBLIC_*` variables in `eas.json` build profiles or as EAS
secrets:

```bash
eas secret:create --scope project \
  --name EXPO_PUBLIC_SUPABASE_URL \
  --value "https://abdaylmwkcmxmsvagfch.supabase.co"
```

#### Supabase Edge Functions

```bash
supabase secrets set TURNSTILE_SECRET_KEY=your-cloudflare-turnstile-secret
supabase functions deploy receipts
```

---

## Security Best Practices

### Public vs Private Variables

**Public variables** (safe in the client bundle):

- Prefixed with `NEXT_PUBLIC_` (Next.js) or `EXPO_PUBLIC_` (Expo).
- Examples: `NEXT_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `NEXT_PUBLIC_BASE_URL`, `*_TURNSTILE_SITE_KEY`.
- The Supabase publishable/anon key is safe to expose **because Row Level
  Security (RLS)** governs what each user can read/write.

**Private variables** (server-side only):

- No public prefix. Never referenced from client code.
- Examples: `MAINTENANCE_MODE`, `TURNSTILE_SECRET_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`.

### Guarding the Service Role Key

- The service-role key bypasses RLS. Keep it **only** in Edge Function secrets.
- Sensitive writes (e.g. receipt creation) are revoked for clients and routed
  through the `receipts` Edge Function, which validates CAPTCHA, tier limits, and
  rate limits before writing with the service role.

---

## Troubleshooting

### `[supabase] Not configured` error

**Symptom**: The app throws `Not configured. Set EXPO_PUBLIC_SUPABASE_URL/ANON_KEY
(native) or NEXT_PUBLIC_SUPABASE_URL/ANON_KEY (web).`

**Solutions**:

1. Ensure the URL and key are set in `.env.local` (Next.js) or `.env` (Expo).
2. Restart the dev server after editing env files.
3. Confirm the correct prefix (`NEXT_PUBLIC_` vs `EXPO_PUBLIC_`).

### Share URLs use the wrong domain

1. Verify `NEXT_PUBLIC_BASE_URL` is set in the production environment.
2. Redeploy after adding the variable.

### CAPTCHA always fails server-side

1. Verify `TURNSTILE_SECRET_KEY` is set as an Edge Function secret.
2. Confirm the client site key (`*_TURNSTILE_SITE_KEY`) matches the same
   Cloudflare Turnstile widget as the secret.

---

## Validation Checklist

Before deploying to production:

- [ ] `*_SUPABASE_URL` and `*_SUPABASE_PUBLISHABLE_KEY` set for both apps
- [ ] `NEXT_PUBLIC_BASE_URL` matches the real domain (HTTPS)
- [ ] `MAINTENANCE_MODE` is `false` for normal operation
- [ ] Turnstile site keys set on clients; `TURNSTILE_SECRET_KEY` set on the Edge Function
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is **not** present in any client bundle
- [ ] Public variables use the correct `NEXT_PUBLIC_` / `EXPO_PUBLIC_` prefix

---

## Related Documentation

- [CAPTCHA Security](./CAPTCHA_SECURITY.md)
- [Cleanup Strategies](./CLEANUP_STRATEGIES.md)
