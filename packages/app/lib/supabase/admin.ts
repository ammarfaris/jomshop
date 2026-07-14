import { Platform } from 'react-native'
import { getSupabase } from './client'
import { archiveAllContestReceiptsAsAdminSupabase } from './receipts'
import type { CreateContestFormData } from 'app/features/admin/createContestSchema'
import {
  slugify,
  extFromName,
  contestCoreFromForm,
  buildTranslationRow,
  translationRowHasContent,
  translationRowsFromForm,
  buildContestSearchPattern,
  diffIds,
  mapContestRow,
  mapTranslationRow,
  mapFileRow,
  chooseFinalMainPath,
  orderFilesMainFirst,
} from './adminTransforms'

/**
 * Supabase admin content-management API (Phase 6). Mirrors the Appwrite admin
 * write paths (host/category managers + contest create/edit) but writes to the
 * Postgres content tables and Supabase Storage. All writes are gated by the
 * `is_admin()` RLS policies (see 20260630000002_content_schema.sql /
 * 20260630000004_storage.sql), so only admins succeed.
 *
 * Shapes intentionally use the Appwrite-flavored `$id` etc. so the existing
 * admin components can consume them with a simple cast, exactly like the read
 * libs do.
 */

const HOSTS_BUCKET = 'contest-hosts'
const CONTESTS_BUCKET = 'contests'

// A picked image: expo-image-picker asset ({ uri, fileName?, mimeType?/type? })
// or a web File.
export type PickedImage =
  | File
  | {
      uri: string
      fileName?: string
      type?: string
      mimeType?: string
    }

/** Resolve a stored object path to a public URL (pass-through for absolute URLs). */
export function contentPublicUrl(
  bucket: string,
  pathOrUrl: string | null | undefined,
): string {
  if (!pathOrUrl) return ''
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  return getSupabase().storage.from(bucket).getPublicUrl(pathOrUrl).data.publicUrl
}

/** Read a picked image into a body supabase-js storage accepts (web + native). */
async function imageToBody(
  asset: PickedImage,
  fallbackType: string,
): Promise<{ body: Blob | ArrayBuffer; contentType: string }> {
  if (Platform.OS === 'web') {
    if (typeof File !== 'undefined' && asset instanceof File) {
      return { body: asset, contentType: asset.type || fallbackType }
    }
    if (typeof Blob !== 'undefined' && asset instanceof Blob) {
      return { body: asset, contentType: (asset as Blob).type || fallbackType }
    }
    const res = await fetch((asset as { uri: string }).uri)
    const blob = await res.blob()
    return { body: blob, contentType: blob.type || fallbackType }
  }
  // Native: an ArrayBuffer is the most reliable body for RN storage uploads.
  const res = await fetch((asset as { uri: string }).uri)
  const arrayBuffer = await res.arrayBuffer()
  return { body: arrayBuffer, contentType: fallbackType }
}

/**
 * Upload an image to a public content bucket and return the stored object path.
 * The path (not a URL) is what we persist in the DB; read libs resolve it to a
 * public URL on the way out.
 */
export async function uploadContentImage(
  bucket: string,
  baseName: string,
  asset: PickedImage,
): Promise<string> {
  const nameForExt =
    (asset as { fileName?: string }).fileName ??
    (typeof File !== 'undefined' && asset instanceof File
      ? asset.name
      : undefined)
  const fallbackType =
    (asset as { mimeType?: string }).mimeType ||
    (asset as { type?: string }).type ||
    'image/jpeg'
  const ext = extFromName(nameForExt, 'jpg')
  const rand = Math.random().toString(36).slice(2, 10)
  const date = new Date().toISOString().split('T')[0]
  const path = `${slugify(baseName || 'img')}-${date}-${rand}.${ext}`

  const { body, contentType } = await imageToBody(asset, fallbackType)
  const { error } = await getSupabase()
    .storage.from(bucket)
    .upload(path, body, { contentType, upsert: false })
  if (error) throw new Error(error.message)
  return path
}

async function removeObject(bucket: string, pathOrUrl: string | null | undefined) {
  if (!pathOrUrl || /^https?:\/\//i.test(pathOrUrl)) return
  try {
    await getSupabase().storage.from(bucket).remove([pathOrUrl])
  } catch {
    // best-effort: a leftover object is harmless and can be GC'd later
  }
}

// ===========================================================================
// Categories
// ===========================================================================

export type CategoryType =
  | 'prize'
  | 'winner_selection'
  | 'how_to_enter'
  | 'business_category'

export interface SupabaseCategoryDoc {
  $id: string
  $createdAt: string
  $updatedAt: string
  slug: string
  name_en: string
  name_ms: string
  priority_order: number
  type: CategoryType
}

export interface CategoryInput {
  slug: string
  name_en: string
  name_ms: string
  priority_order: number
  type: CategoryType
}

export async function listSupabaseCategories(): Promise<SupabaseCategoryDoc[]> {
  const { data, error } = await getSupabase()
    .from('contest_categories')
    .select('id, slug, name_en, name_ms, priority_order, type, created_at')
    .order('priority_order', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    $id: r.id,
    $createdAt: r.created_at,
    $updatedAt: r.created_at,
    slug: r.slug ?? '',
    name_en: r.name_en ?? '',
    name_ms: r.name_ms ?? '',
    priority_order: r.priority_order ?? 0,
    type: (r.type as CategoryType) ?? 'prize',
  }))
}

export async function createSupabaseCategory(input: CategoryInput): Promise<void> {
  const { error } = await getSupabase().from('contest_categories').insert({
    slug: input.slug,
    name_en: input.name_en,
    name_ms: input.name_ms,
    priority_order: input.priority_order,
    type: input.type,
  })
  if (error) throw error
}

export async function updateSupabaseCategory(
  id: string,
  input: CategoryInput,
): Promise<void> {
  const { error } = await getSupabase()
    .from('contest_categories')
    .update({
      slug: input.slug,
      name_en: input.name_en,
      name_ms: input.name_ms,
      priority_order: input.priority_order,
      type: input.type,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteSupabaseCategory(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('contest_categories')
    .delete()
    .eq('id', id)
  if (error) throw error
}

/** Titles of contests linked to this category (for the delete guard). */
export async function findSupabaseContestsUsingCategory(
  id: string,
): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from('contest_categories_map')
    .select('contests(title)')
    .eq('category_id', id)
    .limit(50)
  if (error) throw error
  return (data ?? [])
    .map((r: any) => r.contests?.title)
    .filter((t: unknown): t is string => Boolean(t))
}

// ===========================================================================
// Hosts
// ===========================================================================

export interface SupabaseHostDoc {
  $id: string
  $createdAt: string
  $updatedAt: string
  name: string
  slug: string
  img_id: string // resolved public URL (HostImage renders absolute URLs directly)
  img_token_secret: null
  img_blurhash: string
  bio: string
}

export interface HostInput {
  name: string
  slug: string
  bio: string
  imageAsset?: PickedImage | null
}

export async function listSupabaseHosts(): Promise<SupabaseHostDoc[]> {
  const { data, error } = await getSupabase()
    .from('contest_hosts')
    .select('id, name, slug, img_id, img_blurhash, bio, created_at')
    .order('name', { ascending: true })
    .limit(100)
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    $id: r.id,
    $createdAt: r.created_at,
    $updatedAt: r.created_at,
    name: r.name ?? '',
    slug: r.slug ?? '',
    img_id: contentPublicUrl(HOSTS_BUCKET, r.img_id),
    img_token_secret: null,
    img_blurhash: r.img_blurhash ?? '',
    bio: r.bio ?? '',
  }))
}

export async function createSupabaseHost(input: HostInput): Promise<void> {
  if (!input.imageAsset) throw new Error('An image is required')
  const path = await uploadContentImage(
    HOSTS_BUCKET,
    input.slug || input.name,
    input.imageAsset,
  )
  const { error } = await getSupabase().from('contest_hosts').insert({
    name: input.name,
    slug: input.slug,
    bio: input.bio,
    img_id: path,
    img_blurhash: null,
  })
  if (error) {
    await removeObject(HOSTS_BUCKET, path)
    throw error
  }
}

export async function updateSupabaseHost(
  id: string,
  input: HostInput,
): Promise<void> {
  const supabase = getSupabase()
  const patch: Record<string, unknown> = {
    name: input.name,
    slug: input.slug,
    bio: input.bio,
  }

  if (!input.imageAsset) {
    const { error } = await supabase
      .from('contest_hosts')
      .update(patch)
      .eq('id', id)
    if (error) throw error
    return
  }

  const { data: existing } = await supabase
    .from('contest_hosts')
    .select('img_id')
    .eq('id', id)
    .maybeSingle()

  const newPath = await uploadContentImage(
    HOSTS_BUCKET,
    input.slug || input.name,
    input.imageAsset,
  )
  patch.img_id = newPath
  patch.img_blurhash = null

  const { error } = await supabase
    .from('contest_hosts')
    .update(patch)
    .eq('id', id)
  if (error) {
    await removeObject(HOSTS_BUCKET, newPath)
    throw error
  }

  const oldPath = (existing as { img_id?: string } | null)?.img_id
  if (oldPath && oldPath !== newPath) await removeObject(HOSTS_BUCKET, oldPath)
}

export async function deleteSupabaseHost(id: string): Promise<void> {
  const supabase = getSupabase()
  const { data: existing } = await supabase
    .from('contest_hosts')
    .select('img_id')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.from('contest_hosts').delete().eq('id', id)
  if (error) throw error

  await removeObject(HOSTS_BUCKET, (existing as { img_id?: string } | null)?.img_id)
}

/** Titles of contests linked to this host (for the delete guard). */
export async function findSupabaseContestsUsingHost(
  id: string,
): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from('contest_hosts_map')
    .select('contests(title)')
    .eq('host_id', id)
    .limit(50)
  if (error) throw error
  return (data ?? [])
    .map((r: any) => r.contests?.title)
    .filter((t: unknown): t is string => Boolean(t))
}

// ===========================================================================
// Contests (create / edit)
// ===========================================================================

function assetUri(asset: PickedImage): string {
  return (asset as { uri?: string }).uri ?? ''
}

/**
 * Upsert the two locale translations for an edit. `en` is always written (empty
 * fields cleared to null); `ms` is written when it has content, otherwise any
 * existing `ms` row is removed so stale Malay copy doesn't linger. Relies on the
 * unique (contest_id, locale) constraint.
 */
async function upsertContestTranslations(
  contestId: string,
  form: CreateContestFormData,
): Promise<void> {
  const supabase = getSupabase()

  const en = buildTranslationRow(form, contestId, 'en')
  const { error: enErr } = await supabase
    .from('contest_translations')
    .upsert(en, { onConflict: 'contest_id,locale' })
  if (enErr) throw enErr

  const ms = buildTranslationRow(form, contestId, 'ms')
  if (translationRowHasContent(ms)) {
    const { error: msErr } = await supabase
      .from('contest_translations')
      .upsert(ms, { onConflict: 'contest_id,locale' })
    if (msErr) throw msErr
  } else {
    await supabase
      .from('contest_translations')
      .delete()
      .eq('contest_id', contestId)
      .eq('locale', 'ms')
  }
}

export interface ContestWriteOptions {
  hostIds: string[]
  categoryIds: string[]
  galleryAssets: PickedImage[]
  mainUri: string | null
}

/**
 * Sync one junction table to `desiredIds` by applying only the delta: insert the
 * added rows first, then remove the dropped ones. Rows that aren't changing are
 * left alone, so a failure partway through can never wipe all of a contest's
 * relations (supabase-js has no client-side multi-statement transaction).
 */
async function syncContestJunction(
  table: 'contest_hosts_map' | 'contest_categories_map',
  column: 'host_id' | 'category_id',
  contestId: string,
  desiredIds: string[],
) {
  const supabase = getSupabase()
  const { data: existing, error } = await supabase
    .from(table)
    .select(column)
    .eq('contest_id', contestId)
  if (error) throw error

  const { toAdd, toRemove } = diffIds(
    (existing ?? []).map((r: any) => r[column] as string),
    desiredIds,
  )

  if (toAdd.length) {
    const { error: insErr } = await supabase
      .from(table)
      .insert(toAdd.map((id) => ({ contest_id: contestId, [column]: id })))
    if (insErr) throw insErr
  }
  if (toRemove.length) {
    const { error: delErr } = await supabase
      .from(table)
      .delete()
      .eq('contest_id', contestId)
      .in(column, toRemove)
    if (delErr) throw delErr
  }
}

/** Sync a contest's host + category junctions to the desired id sets. */
async function replaceContestRelations(
  contestId: string,
  hostIds: string[],
  categoryIds: string[],
) {
  await syncContestJunction('contest_hosts_map', 'host_id', contestId, hostIds)
  await syncContestJunction(
    'contest_categories_map',
    'category_id',
    contestId,
    categoryIds,
  )
}

/**
 * Upload the gallery assets and create contest_files rows. The asset flagged as
 * main is uploaded first (file_order 1, label 'main-gallery') and also set as
 * the contest's main_img_id — mirroring the Appwrite create flow so the detail
 * screen renders identically. `startOrder` lets edit append after existing files.
 */
async function uploadContestGallery(
  contestId: string,
  slugBase: string,
  galleryAssets: PickedImage[],
  mainUri: string | null,
  startOrder = 0,
): Promise<void> {
  const supabase = getSupabase()
  const ordered = [...galleryAssets].sort((a, b) => {
    if (assetUri(a) === mainUri) return -1
    if (assetUri(b) === mainUri) return 1
    return 0
  })

  for (let i = 0; i < ordered.length; i++) {
    const asset = ordered[i] as PickedImage
    const isMain = mainUri != null && assetUri(asset) === mainUri
    const order = startOrder + i + 1
    const path = await uploadContentImage(
      CONTESTS_BUCKET,
      `${slugBase || 'contest'}-${order}`,
      asset,
    )

    const { error: fErr } = await supabase.from('contest_files').insert({
      contest_id: contestId,
      storage_path: path,
      label: isMain ? 'main-gallery' : 'gallery',
      file_order: order,
      width: (asset as { width?: number }).width ?? null,
      height: (asset as { height?: number }).height ?? null,
      blurhash: null,
    })
    if (fErr) throw fErr

    if (isMain) {
      const { error: mErr } = await supabase
        .from('contests')
        .update({ main_img_id: path, main_img_blurhash: null })
        .eq('id', contestId)
      if (mErr) throw mErr
    }
  }
}

/**
 * Create a contest: core row -> host/category junctions -> gallery files -> the
 * two locale translations. On any child failure the contest row is removed
 * (children cascade) so a failed create leaves no half-built contest.
 */
export async function createSupabaseContest(
  form: CreateContestFormData,
  opts: ContestWriteOptions,
): Promise<string> {
  const supabase = getSupabase()
  const { data: inserted, error } = await supabase
    .from('contests')
    .insert(contestCoreFromForm(form))
    .select('id')
    .single()
  if (error) throw error
  const contestId = (inserted as { id: string }).id

  try {
    await replaceContestRelations(contestId, opts.hostIds, opts.categoryIds)
    await uploadContestGallery(
      contestId,
      form.slug || form.title,
      opts.galleryAssets,
      opts.mainUri,
    )
    const { error: tErr } = await supabase
      .from('contest_translations')
      .insert(translationRowsFromForm(form, contestId))
    if (tErr) throw tErr
  } catch (e) {
    // Roll the whole thing back (FK cascades remove maps/files/translations).
    // Storage objects may be orphaned — harmless and GC-able later.
    try {
      await supabase.from('contests').delete().eq('id', contestId)
    } catch {}
    throw e
  }

  return contestId
}

// ===========================================================================
// Contests (search / load / update / delete for the Edit tab)
//
// These return Appwrite-flavored shapes (`$id`, host_ids/category_ids arrays,
// ContestFile.file_id, translation *_and_purchases/*_and_submission aliases) so
// EditContestTabContent's existing, backend-agnostic form-population and image
// diffing code can consume them with a cast — exactly like the read libs.
// ===========================================================================

const CONTEST_COLUMNS =
  'id, slug, title, title_ms, summary, summary_ms, start_date, end_date, ' +
  'main_img_id, main_img_blurhash, total_prizes_value_rm, visibility, ' +
  'link_aff_shopee, link_aff_lazada, link_aff_tiktok_shop, ' +
  'link_media_instagram, link_media_facebook, link_media_tiktok, ' +
  'link_media_x, link_media_youtube, link_media_linkedin, link_media_website, ' +
  'created_at, updated_at'

const HOST_MAP_SELECT =
  'host_id, contest_hosts(id, name, slug, img_id, img_blurhash, bio, created_at)'
const CATEGORY_MAP_SELECT =
  'category_id, contest_categories(id, slug, name_en, name_ms, priority_order, type, created_at)'

function mapHostRow(r: any): SupabaseHostDoc {
  return {
    $id: r.id,
    $createdAt: r.created_at,
    $updatedAt: r.created_at,
    name: r.name ?? '',
    slug: r.slug ?? '',
    img_id: contentPublicUrl(HOSTS_BUCKET, r.img_id),
    img_token_secret: null,
    img_blurhash: r.img_blurhash ?? '',
    bio: r.bio ?? '',
  }
}

function mapCategoryRow(r: any): SupabaseCategoryDoc {
  return {
    $id: r.id,
    $createdAt: r.created_at,
    $updatedAt: r.created_at,
    slug: r.slug ?? '',
    name_en: r.name_en ?? '',
    name_ms: r.name_ms ?? '',
    priority_order: r.priority_order ?? 0,
    type: (r.type as CategoryType) ?? 'prize',
  }
}

export interface ContestSearchResult {
  contests: Record<string, any>[]
  hostsByContest: Record<string, SupabaseHostDoc[]>
}

/**
 * Search contests for the Edit tab. `slug` mode is an exact match; `title` mode
 * is a case-insensitive contains over title + slug. Host docs for the results
 * are fetched in a single query (no N+1) and returned keyed by contest id.
 */
export async function searchSupabaseContestsForEdit(
  query: string,
  mode: 'title' | 'slug',
): Promise<ContestSearchResult> {
  const supabase = getSupabase()
  const q = query.trim()

  let rows: any[] = []
  if (mode === 'slug') {
    const { data, error } = await supabase
      .from('contests')
      .select(CONTEST_COLUMNS)
      .eq('slug', q)
      .limit(1)
    if (error) throw error
    rows = data ?? []
  } else {
    const pattern = buildContestSearchPattern(q)
    const { data, error } = await supabase
      .from('contests')
      .select(CONTEST_COLUMNS)
      .or(`title.ilike.${pattern},slug.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) throw error
    rows = data ?? []
  }

  const contests = rows.map((r) => mapContestRow(r))
  const ids = rows.map((r) => r.id)

  const hostsByContest: Record<string, SupabaseHostDoc[]> = {}
  if (ids.length) {
    const { data: hostMaps, error: hmErr } = await supabase
      .from('contest_hosts_map')
      .select(`contest_id, ${HOST_MAP_SELECT}`)
      .in('contest_id', ids)
    if (hmErr) throw hmErr
    for (const m of hostMaps ?? []) {
      const host = (m as any).contest_hosts
      if (!host) continue
      const cid = (m as any).contest_id as string
      ;(hostsByContest[cid] ??= []).push(mapHostRow(host))
    }
  }

  return { contests, hostsByContest }
}

/**
 * List contests sitting at visibility='admin' — i.e. agent-ingested drafts
 * awaiting human review. Backs the Admin → Drafts tab. Same shape as a
 * title-mode search result (contest + hostsByContest), ordered newest-first.
 */
export async function listSupabaseDraftContests(): Promise<ContestSearchResult> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('contests')
    .select(CONTEST_COLUMNS)
    .eq('visibility', 'admin')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error

  const rows: any[] = data ?? []
  const contests = rows.map((r) => mapContestRow(r))
  const ids = rows.map((r) => r.id)

  const hostsByContest: Record<string, SupabaseHostDoc[]> = {}
  if (ids.length) {
    const { data: hostMaps, error: hmErr } = await supabase
      .from('contest_hosts_map')
      .select(`contest_id, ${HOST_MAP_SELECT}`)
      .in('contest_id', ids)
    if (hmErr) throw hmErr
    for (const m of hostMaps ?? []) {
      const host = (m as any).contest_hosts
      if (!host) continue
      const cid = (m as any).contest_id as string
      ;(hostsByContest[cid] ??= []).push(mapHostRow(host))
    }
  }

  return { contests, hostsByContest }
}

export interface EditContestData {
  contest: Record<string, any>
  translations: Record<string, any>[]
  hostDocs: SupabaseHostDoc[]
  categoryDocs: SupabaseCategoryDoc[]
  contestFiles: Record<string, any>[]
}

/** Load a single contest (+ translations, files, host/category docs) for editing. */
export async function loadSupabaseContestForEdit(
  contestId: string,
): Promise<EditContestData> {
  const supabase = getSupabase()

  const { data: c, error } = await supabase
    .from('contests')
    .select(CONTEST_COLUMNS)
    .eq('id', contestId)
    .single()
  if (error) throw error

  const [translationsRes, filesRes, hostMapRes, catMapRes] = await Promise.all([
    supabase.from('contest_translations').select('*').eq('contest_id', contestId),
    supabase
      .from('contest_files')
      .select('*')
      .eq('contest_id', contestId)
      .order('file_order', { ascending: true }),
    supabase
      .from('contest_hosts_map')
      .select(HOST_MAP_SELECT)
      .eq('contest_id', contestId),
    supabase
      .from('contest_categories_map')
      .select(CATEGORY_MAP_SELECT)
      .eq('contest_id', contestId),
  ])
  if (translationsRes.error) throw translationsRes.error
  if (filesRes.error) throw filesRes.error
  if (hostMapRes.error) throw hostMapRes.error
  if (catMapRes.error) throw catMapRes.error

  const hostRows = (hostMapRes.data ?? []).filter((m: any) => m.contest_hosts)
  const catRows = (catMapRes.data ?? []).filter((m: any) => m.contest_categories)

  return {
    contest: mapContestRow(
      c,
      hostRows.map((m: any) => m.host_id),
      catRows.map((m: any) => m.category_id),
    ),
    translations: (translationsRes.data ?? []).map(mapTranslationRow),
    hostDocs: hostRows.map((m: any) => mapHostRow(m.contest_hosts)),
    categoryDocs: catRows.map((m: any) => mapCategoryRow(m.contest_categories)),
    contestFiles: (filesRes.data ?? []).map(mapFileRow),
  }
}

export interface EditContestOptions {
  hostIds: string[]
  categoryIds: string[]
  imagesToDelete: string[] // storage paths (ContestFile.file_id on Supabase)
  newGalleryAssets: PickedImage[]
  mainImageId: string | null // path of the currently selected existing main
  newMainImageUri: string | null // uri of a new asset chosen as main
  slugBase?: string
}

/**
 * Update a contest: core row -> host/category junctions -> translations upsert
 * -> delete removed images -> upload new images -> normalize gallery order and
 * the main image. Ordering is rebuilt so the main image is first (file_order 1,
 * label 'main-gallery') and `main_img_id` points at it, mirroring create/read.
 */
export async function updateSupabaseContest(
  contestId: string,
  form: CreateContestFormData,
  opts: EditContestOptions,
): Promise<void> {
  const supabase = getSupabase()

  const { error: cErr } = await supabase
    .from('contests')
    .update(contestCoreFromForm(form))
    .eq('id', contestId)
  if (cErr) throw cErr

  await replaceContestRelations(contestId, opts.hostIds, opts.categoryIds)
  await upsertContestTranslations(contestId, form)

  // Delete images marked for removal (rows + best-effort storage objects).
  for (const path of opts.imagesToDelete) {
    const { error: dErr } = await supabase
      .from('contest_files')
      .delete()
      .eq('contest_id', contestId)
      .eq('storage_path', path)
    if (dErr) throw dErr
    await removeObject(CONTESTS_BUCKET, path)
  }

  // Upload new gallery assets, appending after the current highest order.
  const { data: current } = await supabase
    .from('contest_files')
    .select('file_order')
    .eq('contest_id', contestId)
    .order('file_order', { ascending: false })
    .limit(1)
  let nextOrder = (current?.[0]?.file_order as number | undefined) ?? 0

  const slugBase = opts.slugBase || form.slug || form.title
  const uploaded: { path: string; uri: string }[] = []
  for (const asset of opts.newGalleryAssets) {
    nextOrder += 1
    const path = await uploadContentImage(
      CONTESTS_BUCKET,
      `${slugBase}-${nextOrder}`,
      asset,
    )
    const { error: fErr } = await supabase.from('contest_files').insert({
      contest_id: contestId,
      storage_path: path,
      label: 'gallery',
      file_order: nextOrder,
      width: (asset as { width?: number }).width ?? null,
      height: (asset as { height?: number }).height ?? null,
      blurhash: null,
    })
    if (fErr) throw fErr
    uploaded.push({ path, uri: assetUri(asset) })
  }

  // Decide the final main image: a newly-uploaded one wins, else the still-present
  // existing selection, else (resolved below) the first remaining file.
  const mainCandidate = chooseFinalMainPath({
    newMainImageUri: opts.newMainImageUri,
    uploaded,
    mainImageId: opts.mainImageId,
    imagesToDelete: opts.imagesToDelete,
  })

  // Normalize ordering + labels + contest.main_img_id.
  const { data: allFiles, error: afErr } = await supabase
    .from('contest_files')
    .select('id, storage_path, file_order')
    .eq('contest_id', contestId)
    .order('file_order', { ascending: true })
  if (afErr) throw afErr

  const { finalMain, ordered } = orderFilesMainFirst(
    (allFiles ?? []) as { id: string; storage_path: string }[],
    mainCandidate,
  )

  if (ordered.length === 0) {
    await supabase
      .from('contests')
      .update({ main_img_id: null, main_img_blurhash: null })
      .eq('id', contestId)
    return
  }

  for (let i = 0; i < ordered.length; i++) {
    const f = ordered[i]
    const { error: uErr } = await supabase
      .from('contest_files')
      .update({ file_order: i + 1, label: i === 0 ? 'main-gallery' : 'gallery' })
      .eq('id', f.id)
    if (uErr) throw uErr
  }

  const { error: mErr } = await supabase
    .from('contests')
    .update({ main_img_id: finalMain, main_img_blurhash: null })
    .eq('id', contestId)
  if (mErr) throw mErr
}

/**
 * Delete a contest. The FK graph cascades every child row (files, translations,
 * host/category maps, upvotes, saves, receipts), so we only remove the contest
 * row and then best-effort clean up its storage objects (which don't cascade).
 */
export async function deleteSupabaseContest(contestId: string): Promise<void> {
  const supabase = getSupabase()

  // Preserve every user's receipts before deleting: the contest FK cascade would
  // otherwise drop the receipt rows outright. Routed through the admin-gated
  // Edge Function (the archive bucket is service-role only) and throws unless
  // archiving is fully clean, so a failure aborts the delete rather than losing
  // receipts. A contest with no receipts is a clean no-op.
  await archiveAllContestReceiptsAsAdminSupabase(contestId, 'Contest deleted by admin')

  const { data: files } = await supabase
    .from('contest_files')
    .select('storage_path')
    .eq('contest_id', contestId)
  const { data: contest } = await supabase
    .from('contests')
    .select('main_img_id')
    .eq('id', contestId)
    .maybeSingle()

  const { error } = await supabase.from('contests').delete().eq('id', contestId)
  if (error) throw error

  const paths = new Set<string>()
  for (const f of files ?? []) {
    const p = (f as { storage_path?: string }).storage_path
    if (p && !/^https?:\/\//i.test(p)) paths.add(p)
  }
  const mainId = (contest as { main_img_id?: string } | null)?.main_img_id
  if (mainId && !/^https?:\/\//i.test(mainId)) paths.add(mainId)
  if (paths.size) {
    try {
      await supabase.storage.from(CONTESTS_BUCKET).remove(Array.from(paths))
    } catch {
      // best-effort: orphaned objects are harmless and can be GC'd later
    }
  }
}

export { HOSTS_BUCKET, CONTESTS_BUCKET }
