import * as v from 'valibot'

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
    v.maxLength(100)
  ),
  title_ms: v.optional(v.pipe(v.string(), v.maxLength(100))),
  summary: v.pipe(
    v.string(),
    v.minLength(1, 'Summary is required'),
    v.maxLength(200, 'Summary must be 200 characters or less')
  ),
  summary_ms: v.optional(
    v.pipe(
      v.string(),
      v.maxLength(200, 'Summary must be 200 characters or less')
    )
  ),

  // Dates
  start_date: v.pipe(v.string(), v.minLength(1, 'Start date is required')),
  end_date: v.pipe(v.string(), v.minLength(1, 'End date is required')),

  // Slug
  slug: v.pipe(
    v.string(),
    v.minLength(1, 'Slug is required'),
    v.maxLength(200)
  ),

  // Optional fields
  total_prizes_value_rm: v.optional(v.string()),
  link_aff_shopee: optionalUrl(1000),
  link_aff_lazada: optionalUrl(1000),
  link_aff_tiktok_shop: optionalUrl(1000),

  // Social Media Links
  link_media_instagram: optionalUrl(400),
  link_media_facebook: optionalUrl(400),
  link_media_tiktok: optionalUrl(200),
  link_media_x: optionalUrl(200),
  link_media_youtube: optionalUrl(200),
  link_media_linkedin: optionalUrl(400),
  link_media_website: optionalUrl(400),

  // Visibility (default 'users' - visible only to logged-in users)
  // 'any' = visible to everyone including non-logged in users
  // 'users' = visible only to logged-in users
  // 'admin' = visible only to admins
  visibility: v.picklist(['any', 'users', 'admin']),

  // Translation fields - English (Required)
  prizes_en: v.pipe(
    v.string(),
    v.minLength(1, 'Prizes & Prizes Limit (English) is required'),
    v.maxLength(2000)
  ),
  link_tnc_en: optionalUrl(300), // No longer required
  link_faq_en: optionalUrl(300),
  eligible_products_en: v.pipe(
    v.string(),
    v.minLength(1, 'Eligible Products & Purchases (English) is required'),
    v.maxLength(2400)
  ),
  eligible_participants_en: v.pipe(
    v.string(),
    v.minLength(1, 'Eligible Participants (English) is required'),
    v.maxLength(1500)
  ),
  eligible_participants_exclusion_en: v.optional(
    v.pipe(v.string(), v.maxLength(1000))
  ),
  eligible_stores_en: v.pipe(
    v.string(),
    v.minLength(1, 'Eligible Stores (English) is required'),
    v.maxLength(2000)
  ),
  winners_selection_method_en: v.pipe(
    v.string(),
    v.minLength(1, 'Winners Selection Method (English) is required'),
    v.maxLength(2000)
  ),
  entry_method_en: v.pipe(
    v.string(),
    v.minLength(1, 'Entry Method & Submission (English) is required'),
    v.maxLength(2000)
  ),
  winners_list_and_announcement_en: v.pipe(
    v.string(),
    v.minLength(1, 'Winners List and Announcement (English) is required'),
    v.maxLength(1000)
  ),
  winners_comm_and_timeline_en: v.pipe(
    v.string(),
    v.minLength(
      1,
      'Winners Communication Channel & Timeline (English) is required'
    ),
    v.maxLength(1500)
  ),

  // Translation fields - Malay
  prizes_ms: v.optional(v.pipe(v.string(), v.maxLength(2000))),
  link_tnc_ms: optionalUrl(300),
  link_faq_ms: optionalUrl(300),
  eligible_products_ms: v.optional(v.pipe(v.string(), v.maxLength(2400))),
  eligible_participants_ms: v.optional(v.pipe(v.string(), v.maxLength(1500))),
  eligible_participants_exclusion_ms: v.optional(
    v.pipe(v.string(), v.maxLength(1000))
  ),
  eligible_stores_ms: v.optional(v.pipe(v.string(), v.maxLength(2000))),
  winners_selection_method_ms: v.optional(
    v.pipe(v.string(), v.maxLength(2000))
  ),
  winners_comm_and_timeline_ms: v.optional(
    v.pipe(v.string(), v.maxLength(1500))
  ),
  entry_method_ms: v.optional(v.pipe(v.string(), v.maxLength(2000))),
  winners_list_and_announcement_ms: v.optional(
    v.pipe(v.string(), v.maxLength(1000))
  ),
})

export type CreateContestFormData = v.InferOutput<typeof createContestSchema>
