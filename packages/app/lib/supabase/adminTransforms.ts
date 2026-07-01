/**
 * Pure, dependency-free transforms for the Supabase admin content lib.
 *
 * Everything here is deliberately free of `react-native`, the Supabase client,
 * and any cross-module import — which keeps the tricky mapping/decision logic
 * unit-testable under plain ts-jest (node) without mocking the world or wiring
 * path aliases. `admin.ts` composes these with the actual I/O and applies the
 * strong `CreateContestFormData` type at its public boundaries.
 *
 * The form is typed loosely here (`ContestFormInput`) on purpose: these helpers
 * only ever read string-ish fields by name.
 */

/** Loose view of the create/edit form — just the fields these transforms read. */
export type ContestFormInput = Record<string, any>

export const clean = (s: string | null | undefined): string | null => {
  const v = (s ?? '').trim()
  return v.length ? v : null
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function extFromName(name: string | undefined, fallback = 'jpg'): string {
  if (!name) return fallback
  const m = name.match(/\.([a-zA-Z0-9]+)$/)
  return m && typeof m[1] === 'string' ? m[1].toLowerCase() : fallback
}

/** Map the create/edit form to the `contests` table columns. */
export function contestCoreFromForm(
  form: ContestFormInput,
): Record<string, unknown> {
  return {
    title: form.title,
    title_ms: clean(form.title_ms),
    summary: form.summary,
    summary_ms: clean(form.summary_ms),
    start_date: new Date(form.start_date).toISOString(),
    end_date: new Date(form.end_date).toISOString(),
    slug: form.slug,
    total_prizes_value_rm: form.total_prizes_value_rm
      ? parseFloat(form.total_prizes_value_rm)
      : null,
    visibility: form.visibility ?? 'users',
    link_aff_shopee: clean(form.link_aff_shopee),
    link_aff_lazada: clean(form.link_aff_lazada),
    link_aff_tiktok_shop: clean(form.link_aff_tiktok_shop),
    link_media_instagram: clean(form.link_media_instagram),
    link_media_facebook: clean(form.link_media_facebook),
    link_media_tiktok: clean(form.link_media_tiktok),
    link_media_x: clean(form.link_media_x),
    link_media_youtube: clean(form.link_media_youtube),
    link_media_linkedin: clean(form.link_media_linkedin),
    link_media_website: clean(form.link_media_website),
  }
}

/**
 * Build one contest_translations row for a locale. Column stems are the Supabase
 * names (eligible_products / entry_method), not the Appwrite *_and_purchases /
 * *_and_submission aliases. Empty fields become null so an update can clear them.
 */
export function buildTranslationRow(
  form: ContestFormInput,
  contestId: string,
  locale: 'en' | 'ms',
): Record<string, unknown> {
  return {
    contest_id: contestId,
    locale,
    prizes: clean((form as any)[`prizes_${locale}`]),
    link_tnc: clean((form as any)[`link_tnc_${locale}`]),
    link_faq: clean((form as any)[`link_faq_${locale}`]),
    eligible_products: clean((form as any)[`eligible_products_${locale}`]),
    eligible_participants: clean((form as any)[`eligible_participants_${locale}`]),
    eligible_participants_exclusion: clean(
      (form as any)[`eligible_participants_exclusion_${locale}`],
    ),
    eligible_stores: clean((form as any)[`eligible_stores_${locale}`]),
    winners_selection_method: clean(
      (form as any)[`winners_selection_method_${locale}`],
    ),
    entry_method: clean((form as any)[`entry_method_${locale}`]),
    winners_list_and_announcement: clean(
      (form as any)[`winners_list_and_announcement_${locale}`],
    ),
    winners_comm_and_timeline: clean(
      (form as any)[`winners_comm_and_timeline_${locale}`],
    ),
  }
}

/** True when a locale row carries any translated content (ignores keys/ids). */
export function translationRowHasContent(row: Record<string, unknown>): boolean {
  return Object.entries(row).some(
    ([k, v]) => k !== 'contest_id' && k !== 'locale' && v,
  )
}

/**
 * Build contest_translations rows from the form. `en` always emitted (required
 * fields are validated by the form); `ms` only when it carries content.
 */
export function translationRowsFromForm(
  form: ContestFormInput,
  contestId: string,
): Record<string, unknown>[] {
  const rows = [buildTranslationRow(form, contestId, 'en')]
  const ms = buildTranslationRow(form, contestId, 'ms')
  if (translationRowHasContent(ms)) rows.push(ms)
  return rows
}

/**
 * Build a safe ILIKE pattern for the contest title/slug `or(...)` search. Drops
 * chars that break PostgREST's `or(...)` grammar (commas/parens), then escapes
 * LIKE wildcards so the remaining text matches literally.
 */
export function buildContestSearchPattern(q: string): string {
  const escaped = q
    .replace(/[,()]/g, ' ')
    .replace(/[%_]/g, (m) => `\\${m}`)
    .trim()
  return `%${escaped}%`
}

/**
 * Compute the minimal add/remove set to move a junction from `existing` to
 * `desired`. Used to sync host/category maps without blowing away rows that
 * aren't changing (so a mid-update failure can't wipe all relations).
 */
export function diffIds(
  existing: string[],
  desired: string[],
): { toAdd: string[]; toRemove: string[] } {
  const have = new Set(existing)
  const want = new Set(desired)
  return {
    toAdd: desired.filter((id) => !have.has(id)),
    toRemove: existing.filter((id) => !want.has(id)),
  }
}

/** contests row -> Appwrite-flavored ContestDocument (host/category ids injected). */
export function mapContestRow(
  r: any,
  hostIds: string[] = [],
  categoryIds: string[] = [],
): Record<string, any> {
  return {
    $id: r.id,
    $createdAt: r.created_at,
    $updatedAt: r.updated_at ?? r.created_at,
    title: r.title,
    title_ms: r.title_ms,
    summary: r.summary,
    summary_ms: r.summary_ms,
    start_date: r.start_date,
    end_date: r.end_date,
    host_ids: hostIds,
    category_ids: categoryIds,
    slug: r.slug,
    total_prizes_value_rm: r.total_prizes_value_rm,
    link_aff_shopee: r.link_aff_shopee,
    link_aff_lazada: r.link_aff_lazada,
    link_aff_tiktok_shop: r.link_aff_tiktok_shop,
    link_media_instagram: r.link_media_instagram,
    link_media_facebook: r.link_media_facebook,
    link_media_tiktok: r.link_media_tiktok,
    link_media_x: r.link_media_x,
    link_media_youtube: r.link_media_youtube,
    link_media_linkedin: r.link_media_linkedin,
    link_media_website: r.link_media_website,
    main_img_id: r.main_img_id,
    main_img_token_secret: null,
    main_img_blurhash: r.main_img_blurhash,
    visibility: r.visibility ?? 'users',
  }
}

/** contest_translations row -> Appwrite-flavored shape (column aliases restored). */
export function mapTranslationRow(r: any): Record<string, any> {
  return {
    $id: r.id,
    contest_id: r.contest_id,
    locale: r.locale,
    prizes: r.prizes,
    link_tnc: r.link_tnc,
    link_faq: r.link_faq,
    eligible_products_and_purchases: r.eligible_products,
    eligible_participants: r.eligible_participants,
    eligible_participants_exclusion: r.eligible_participants_exclusion,
    eligible_stores: r.eligible_stores,
    winners_selection_method: r.winners_selection_method,
    winners_comm_and_timeline: r.winners_comm_and_timeline,
    entry_method_and_submission: r.entry_method,
    winners_list_and_announcement: r.winners_list_and_announcement,
  }
}

/** contest_files row -> Appwrite-flavored ContestFile (file_id = storage path). */
export function mapFileRow(r: any): Record<string, any> {
  return {
    $id: r.id,
    file_id: r.storage_path,
    contest_id: r.contest_id,
    preview_img_width: r.width,
    preview_img_height: r.height,
    file_label: r.label,
    file_order: r.file_order,
    token_id: null,
    token_secret: null,
    img_blurhash: r.blurhash,
  }
}

/**
 * Decide which image should be the contest's main on update. A newly-uploaded
 * asset chosen as main wins; otherwise the still-present existing selection; else
 * null (the caller falls back to the first remaining file).
 */
export function chooseFinalMainPath(params: {
  newMainImageUri: string | null
  uploaded: { path: string; uri: string }[]
  mainImageId: string | null
  imagesToDelete: string[]
}): string | null {
  const { newMainImageUri, uploaded, mainImageId, imagesToDelete } = params
  if (newMainImageUri) {
    const match = uploaded.find((u) => u.uri === newMainImageUri)
    if (match) return match.path
  }
  if (mainImageId && !imagesToDelete.includes(mainImageId)) return mainImageId
  return null
}

/**
 * Order files so the main image is first, resolving the candidate to the first
 * file when it's missing/invalid. Returns the resolved main plus the ordered
 * list; the caller assigns file_order = index + 1 and labels index 0 as main.
 */
export function orderFilesMainFirst<T extends { storage_path: string }>(
  files: T[],
  finalMainCandidate: string | null,
): { finalMain: string | null; ordered: T[] } {
  const first = files[0]
  if (!first) return { finalMain: null, ordered: [] }
  let finalMain = finalMainCandidate
  if (!finalMain || !files.some((f) => f.storage_path === finalMain)) {
    finalMain = first.storage_path
  }
  const ordered = [
    ...files.filter((f) => f.storage_path === finalMain),
    ...files.filter((f) => f.storage_path !== finalMain),
  ]
  return { finalMain, ordered }
}
