# Fixes

This directory documents notable bug fixes in the JomContest app. Each file is a
self-contained write-up of a problem, its root cause, and the solution.

> Backend note: JomContest runs entirely on **Supabase** (Auth, Postgres + RLS,
> Storage, Edge Functions). Older fix docs that were specific to the retired
> Appwrite backend (receipt-function timeouts, Appwrite Storage transfer bugs,
> Meilisearch re-indexing, Appwrite function deployment) have been removed as
> part of the migration cleanup.

## Current fix docs

- [THEME_SYNC_FIX.md](./THEME_SYNC_FIX.md) — Sync the light/dark/system theme
  across devices from the user's Supabase profile preferences.
- [COLOR_THEME_FLASH_FIX.md](./COLOR_THEME_FLASH_FIX.md) — Eliminate the green→blue
  color-theme flash on web page refresh with local caching + a blocking script.
- [COLOR_THEME_NATIVE_FIX.md](./COLOR_THEME_NATIVE_FIX.md) — Native color-theme
  behavior fixes.
- [SVG_HOST_IMAGE_FIX.md](./SVG_HOST_IMAGE_FIX.md) — Reliable host-logo rendering
  (including SVGs) from Supabase Storage public URLs across web and native.

## Related

- [Environment Variables](../general/ENVIRONMENT_VARIABLES.md)
- [CAPTCHA Security](../general/CAPTCHA_SECURITY.md)
