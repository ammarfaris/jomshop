import * as v from 'valibot'
import {
  CONTEST_CHAR_LIMITS as C,
  TRANSLATION_CHAR_LIMITS as T,
} from './contestFieldLimits'

// Custom URL validation that allows empty strings
const optionalUrl = (maxLen: number) =>
  v.optional(
    v.pipe(
      v.string(),
      v.maxLength(maxLen),
      v.check(
        (value) => value === '' || /^https?:\/\/.+/.test(value),
        'Must be a valid URL'
      )
    )
  )

export const createContestSchema = v.object({
  // Basic contest info
  title: v.pipe(
    v.string(),
    v.minLength(1, 'Title is required'),
    v.maxLength(C.title)
  ),
  title_ms: v.optional(v.pipe(v.string(), v.maxLength(C.title_ms))),
  summary: v.pipe(
    v.string(),
    v.minLength(1, 'Summary is required'),
    v.maxLength(C.summary, `Summary must be ${C.summary} characters or less`)
  ),
  summary_ms: v.optional(
    v.pipe(
      v.string(),
      v.maxLength(
        C.summary_ms,
        `Summary must be ${C.summary_ms} characters or less`
      )
    )
  ),

  // Dates
  start_date: v.pipe(v.string(), v.minLength(1, 'Start date is required')),
  end_date: v.pipe(v.string(), v.minLength(1, 'End date is required')),

  // Slug
  slug: v.pipe(
    v.string(),
    v.minLength(1, 'Slug is required'),
    v.maxLength(C.slug)
  ),

  // Optional fields
  total_prizes_value_rm: v.optional(v.string()),
  link_aff_shopee: optionalUrl(C.link_aff_shopee),
  link_aff_lazada: optionalUrl(C.link_aff_lazada),
  link_aff_tiktok_shop: optionalUrl(C.link_aff_tiktok_shop),

  // Social Media Links
  link_media_instagram: optionalUrl(C.link_media_instagram),
  link_media_facebook: optionalUrl(C.link_media_facebook),
  link_media_tiktok: optionalUrl(C.link_media_tiktok),
  link_media_x: optionalUrl(C.link_media_x),
  link_media_youtube: optionalUrl(C.link_media_youtube),
  link_media_linkedin: optionalUrl(C.link_media_linkedin),
  link_media_website: optionalUrl(C.link_media_website),

  // Visibility (default 'users' - visible only to logged-in users)
  // 'any' = visible to everyone including non-logged in users
  // 'users' = visible only to logged-in users
  // 'admin' = visible only to admins
  visibility: v.picklist(['any', 'users', 'admin']),

  // Translation fields - English (Required)
  prizes_en: v.pipe(
    v.string(),
    v.minLength(1, 'Prizes & Prizes Limit (English) is required'),
    v.maxLength(T.prizes)
  ),
  link_tnc_en: optionalUrl(T.link_tnc), // No longer required
  link_faq_en: optionalUrl(T.link_faq),
  eligible_products_en: v.pipe(
    v.string(),
    v.minLength(1, 'Eligible Products & Purchases (English) is required'),
    v.maxLength(T.eligible_products)
  ),
  eligible_participants_en: v.pipe(
    v.string(),
    v.minLength(1, 'Eligible Participants (English) is required'),
    v.maxLength(T.eligible_participants)
  ),
  eligible_participants_exclusion_en: v.optional(
    v.pipe(v.string(), v.maxLength(T.eligible_participants_exclusion))
  ),
  eligible_stores_en: v.pipe(
    v.string(),
    v.minLength(1, 'Eligible Stores (English) is required'),
    v.maxLength(T.eligible_stores)
  ),
  winners_selection_method_en: v.pipe(
    v.string(),
    v.minLength(1, 'Winners Selection Method (English) is required'),
    v.maxLength(T.winners_selection_method)
  ),
  entry_method_en: v.pipe(
    v.string(),
    v.minLength(1, 'Entry Method & Submission (English) is required'),
    v.maxLength(T.entry_method)
  ),
  winners_list_and_announcement_en: v.pipe(
    v.string(),
    v.minLength(1, 'Winners List and Announcement (English) is required'),
    v.maxLength(T.winners_list_and_announcement)
  ),
  winners_comm_and_timeline_en: v.pipe(
    v.string(),
    v.minLength(
      1,
      'Winners Communication Channel & Timeline (English) is required'
    ),
    v.maxLength(T.winners_comm_and_timeline)
  ),

  // Translation fields - Malay
  prizes_ms: v.optional(v.pipe(v.string(), v.maxLength(T.prizes))),
  link_tnc_ms: optionalUrl(T.link_tnc),
  link_faq_ms: optionalUrl(T.link_faq),
  eligible_products_ms: v.optional(
    v.pipe(v.string(), v.maxLength(T.eligible_products))
  ),
  eligible_participants_ms: v.optional(
    v.pipe(v.string(), v.maxLength(T.eligible_participants))
  ),
  eligible_participants_exclusion_ms: v.optional(
    v.pipe(v.string(), v.maxLength(T.eligible_participants_exclusion))
  ),
  eligible_stores_ms: v.optional(
    v.pipe(v.string(), v.maxLength(T.eligible_stores))
  ),
  winners_selection_method_ms: v.optional(
    v.pipe(v.string(), v.maxLength(T.winners_selection_method))
  ),
  winners_comm_and_timeline_ms: v.optional(
    v.pipe(v.string(), v.maxLength(T.winners_comm_and_timeline))
  ),
  entry_method_ms: v.optional(v.pipe(v.string(), v.maxLength(T.entry_method))),
  winners_list_and_announcement_ms: v.optional(
    v.pipe(v.string(), v.maxLength(T.winners_list_and_announcement))
  ),
})

export type CreateContestFormData = v.InferOutput<typeof createContestSchema>
