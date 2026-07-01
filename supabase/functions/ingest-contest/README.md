# `ingest-contest` Edge Function

Machine-editor entry point for the **OpenClaw** contest-ingestion pipeline. It
accepts a structured contest payload (core fields + the 9 T&C fields × 2 locales
+ images) and creates a full contest **exactly like the admin "Create Contest"
flow**, but forces `visibility = 'admin'` so nothing goes live until a human
approves it in the Admin panel. It returns a review deep-link.

## Endpoint

```
POST https://<project-ref>.supabase.co/functions/v1/ingest-contest
Content-Type: application/json
```

## Auth (either one)

| Method | Header | Who |
| --- | --- | --- |
| Shared secret (normal path) | `x-ingest-key: <INGEST_CONTEST_KEY>` | the machine editor (OpenClaw) |
| Admin JWT | `Authorization: Bearer <user JWT>` | a human admin calling it directly |

`verify_jwt` is disabled at the gateway (see `supabase/config.toml`); the function
authenticates the caller itself.

## Request body

```jsonc
{
  "contest": {
    "title": "Shopee x iPhone Giveaway",          // required, ≤100
    "title_ms": "Cabutan iPhone Shopee",          // optional, ≤100
    "summary": "Win an iPhone 15 Pro ...",         // required, ≤200
    "summary_ms": "Menangi iPhone 15 Pro ...",     // optional, ≤200
    "start_date": "2026-07-01T00:00:00+08:00",     // required, ISO
    "end_date": "2026-07-31T23:59:59+08:00",       // required, ISO, must be > start
    "total_prizes_value_rm": 12000,                 // optional (number or numeric string)
    "slug": "optional-custom-slug",                 // optional; auto-generated if omitted
    "links": {                                      // all optional
      "aff_shopee": "https://...",  "aff_lazada": "https://...",
      "aff_tiktok_shop": "https://...",
      "instagram": "https://...",   "facebook": "https://...",
      "tiktok": "https://...",      "x": "https://...",
      "youtube": "https://...",     "linkedin": "https://...",
      "website": "https://..."
    }
  },

  "translations": {
    "en": {                                         // English REQUIRED (see table)
      "eligible_participants":            "...",     // field 1
      "eligible_participants_exclusion":  "...",     // field 2 (optional)
      "eligible_products":                "...",     // field 3
      "eligible_stores":                  "...",     // field 4
      "prizes":                           "...",     // field 5
      "entry_method":                     "...",     // field 6
      "winners_selection_method":         "...",     // field 7
      "winners_comm_and_timeline":        "...",     // field 8
      "winners_list_and_announcement":    "...",     // field 9
      "link_tnc": "https://...",                     // optional
      "link_faq": "https://..."                      // optional
    },
    "ms": { /* same keys, all optional — omit or leave empty to skip the MS row */ }
  },

  "images": [                                        // optional, ≤10
    { "url": "https://.../poster.jpg", "isMain": true },
    { "url": "https://.../detail-1.jpg" },
    { "base64": "data:image/png;base64,iVBORw0...", "contentType": "image/png" }
  ],

  "host_ids": ["<existing contest_hosts.id>"],       // optional (must already exist)
  "category_ids": ["<existing contest_categories.id>"] // optional (must already exist)
}
```

### The 9 T&C fields → DB columns

| # | T&C field | JSON key (`translations.<locale>.*`) | EN required | Max |
| --- | --- | --- | --- | --- |
| 1 | Eligible Participants | `eligible_participants` | ✅ | 1500 |
| 2 | Exclusions (Non-Eligible) | `eligible_participants_exclusion` | — | 1000 |
| 3 | Eligible Purchases & Products | `eligible_products` | ✅ | 2400 |
| 4 | Eligible Stores | `eligible_stores` | ✅ | 2000 |
| 5 | Prizes & Limit per Participant | `prizes` | ✅ | 2000 |
| 6 | How to Enter | `entry_method` | ✅ | 2000 |
| 7 | Winners Selection Method | `winners_selection_method` | ✅ | 2000 |
| 8 | Winners Comm. Channel & Timeline | `winners_comm_and_timeline` | ✅ | 1500 |
| 9 | Winners List & Announcement | `winners_list_and_announcement` | ✅ | 1000 |

Notes:
- Content is Markdown (the app renders it) — pass the copy-paste-ready section
  bodies **without** the section titles.
- Malay (`ms`) is optional; if the whole `ms` block is empty, no MS translation
  row is created.
- Images: the asset with `"isMain": true` (or the first image if none is flagged)
  becomes the contest's main image; the rest become gallery files. Remote `url`s
  are fetched server-side (public hosts only; ≤15 MB; `image/*` only).

## Responses

**201 Created**

```json
{
  "success": true,
  "contestId": "8f3c...",
  "slug": "shopee-x-iphone-giveaway-from-2026-07-01-until-2026-07-31",
  "visibility": "admin",
  "reviewUrl": "https://jomcontest.com/admin?tab=edit&slug=shopee-x-iphone-giveaway-from-2026-07-01-until-2026-07-31"
}
```

Open `reviewUrl` (as an admin) → the Edit tab auto-searches the pending contest;
click it, review, then set visibility to `users`/`any` and save to publish.

**Errors**

| Status | Meaning |
| --- | --- |
| 400 | Invalid JSON body |
| 401 | Missing/incorrect `x-ingest-key` and no valid admin JWT |
| 422 | `{ "success": false, "error": "Validation failed", "errors": [ ... ] }` |
| 500 | Insert/ingest failed (the partial contest is rolled back) |

On any child-step failure (relations, images, translations) the contest row is
deleted so a failed ingest never leaves a half-built draft.

## Deploy

```bash
supabase functions deploy ingest-contest

# Secrets (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are auto-injected)
supabase secrets set INGEST_CONTEST_KEY="$(openssl rand -hex 32)"
supabase secrets set SITE_URL="https://jomcontest.com"   # optional; used for reviewUrl
```

## Example

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/ingest-contest" \
  -H "content-type: application/json" \
  -H "x-ingest-key: $INGEST_CONTEST_KEY" \
  --data-binary @contest.json
```
