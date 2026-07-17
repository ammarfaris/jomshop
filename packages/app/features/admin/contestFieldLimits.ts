// ---------------------------------------------------------------------------
// Single source of truth for contest character limits on the client. Used by
// createContestSchema (create/edit forms) and the detail page's inline
// editors, so a limit change happens in exactly one place here.
//
// The database enforces the same numbers via CHECK constraints — see
// supabase/migrations/20260717000001_content_char_limits.sql. Postgres can't
// read this file, so changing a limit also needs a follow-up migration that
// drops and re-adds the matching constraint.
//
// Keys are the Supabase column names (contests / contest_translations).
// ---------------------------------------------------------------------------

export const CONTEST_CHAR_LIMITS = {
  title: 100,
  title_ms: 100,
  summary: 200,
  summary_ms: 200,
  slug: 200,
  link_aff_shopee: 1000,
  link_aff_lazada: 1000,
  link_aff_tiktok_shop: 1000,
  link_media_instagram: 400,
  link_media_facebook: 400,
  link_media_tiktok: 200,
  link_media_x: 200,
  link_media_youtube: 200,
  link_media_linkedin: 400,
  link_media_website: 400,
} as const

export const TRANSLATION_CHAR_LIMITS = {
  prizes: 2000,
  link_tnc: 300,
  link_faq: 300,
  eligible_products: 2400,
  eligible_participants: 1500,
  eligible_participants_exclusion: 1000,
  eligible_stores: 2000,
  winners_selection_method: 2000,
  entry_method: 2000,
  winners_list_and_announcement: 1000,
  winners_comm_and_timeline: 1500,
} as const
