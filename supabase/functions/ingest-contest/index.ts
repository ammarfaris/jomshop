// @ts-nocheck Deno Edge Function — type-checked by Deno/Supabase on deploy, not
// by the app's Node/React Native tsconfig (which lacks Deno + remote-import types).
//
// ingest-contest Edge Function (Deno) — the machine-editor entry point for the
// OpenClaw contest-ingestion pipeline.
//
// What it does: accepts a structured contest payload (core fields + the 9 T&C
// fields x2 locales + images), then creates a FULL contest exactly like the
// admin "Create Contest" flow (contests -> host/category junctions -> gallery
// files -> contest_translations) BUT forces visibility='admin' so nothing goes
// live until a human flips it in the Admin panel. Returns a review deep-link.
//
// Why an Edge Function (not a direct client insert): the ingesting agent is a
// machine with no Supabase user session, and contest writes are admin-gated by
// RLS. This function authenticates the agent with a shared secret and performs
// the writes with the service-role key, while still guaranteeing the safety
// property that ingested contests are never publicly visible on creation.
//
// Auth (either is accepted):
//   * x-ingest-key: <INGEST_CONTEST_KEY>   (machine editor — the normal path)
//   * Authorization: Bearer <admin user JWT> (a human admin calling it directly)
//
// Deploy:  supabase functions deploy ingest-contest
// Secrets: supabase secrets set INGEST_CONTEST_KEY=<long-random-string>
//          supabase secrets set SITE_URL=https://jomcontest.com   (optional)
//   (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-ingest-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CONTESTS_BUCKET = 'contests'
const MAX_IMAGES = 10
const MAX_IMAGE_BYTES = 15 * 1024 * 1024 // 15 MB per image
const MAX_IMAGE_REDIRECTS = 5
const MAX_RELATION_IDS = 50

// Contest-level max lengths (mirror createContestSchema.ts / DB CHECK constraints).
const CONTEST_LIMITS = {
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
}

// Canonical contest link columns -> accepted payload keys (short schema key first).
const CONTEST_LINK_ALIASES = {
  link_aff_shopee: ['aff_shopee', 'link_aff_shopee'],
  link_aff_lazada: ['aff_lazada', 'link_aff_lazada'],
  link_aff_tiktok_shop: ['aff_tiktok_shop', 'link_aff_tiktok_shop'],
  link_media_instagram: ['instagram', 'link_media_instagram'],
  link_media_facebook: ['facebook', 'link_media_facebook'],
  link_media_tiktok: ['tiktok', 'link_media_tiktok'],
  link_media_x: ['x', 'twitter', 'link_media_x'],
  link_media_youtube: ['youtube', 'link_media_youtube'],
  link_media_linkedin: ['linkedin', 'link_media_linkedin'],
  link_media_website: ['website', 'link_media_website'],
} as const

// Per-locale translation field max lengths (mirror createContestSchema.ts).
const TRANSLATION_LIMITS: Record<string, number> = {
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
}

// Fields REQUIRED in the English translation (match the form's required set).
// Note: eligible_participants_exclusion, link_tnc, link_faq are optional.
const REQUIRED_EN = [
  'prizes',
  'eligible_products',
  'eligible_participants',
  'eligible_stores',
  'winners_selection_method',
  'entry_method',
  'winners_list_and_announcement',
  'winners_comm_and_timeline',
]

const TRANSLATION_FIELDS = Object.keys(TRANSLATION_LIMITS)

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function clean(s: unknown): string | null {
  const v = (s ?? '').toString().trim()
  return v.length ? v : null
}

function isHttpUrl(v: string): boolean {
  return /^https?:\/\/.+/i.test(v)
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  )
}

// Mirrors adminTransforms.slugify so ingested slugs match the app's convention.
function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Local calendar date (YYYY-MM-DD) — matches CreateContestTabContent.generateSlug.
function localDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(v: unknown): Date | null {
  if (!v) return null
  const d = new Date(v as string)
  return isNaN(d.getTime()) ? null : d
}

// Constant-time string compare for the shared secret.
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  if (ab.length !== bb.length) return false
  let out = 0
  for (let i = 0; i < ab.length; i++) out |= ab[i] ^ bb[i]
  return out === 0
}

// Block non-public hosts (defense-in-depth against SSRF when fetching images).
function isSafePublicUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  const h = u.hostname.toLowerCase()
  if (h === 'localhost' || h === '0.0.0.0' || h === '::1' || h === '[::1]') {
    return false
  }
  if (h.endsWith('.local') || h.endsWith('.internal')) return false
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    if (a === 0 || a === 10 || a === 127) return false // this/private/loopback
    if (a === 169 && b === 254) return false // link-local (cloud metadata)
    if (a === 192 && b === 168) return false // private
    if (a === 172 && b >= 16 && b <= 31) return false // private
  }
  return true
}

function extFromContentType(ct: string): string {
  const c = (ct || '').toLowerCase()
  if (c.includes('png')) return 'png'
  if (c.includes('webp')) return 'webp'
  if (c.includes('gif')) return 'gif'
  return 'jpg'
}

function base64ToBytes(b64: string): Uint8Array {
  const stripped = b64.replace(/^data:[^;]+;base64,/, '')
  const bin = atob(stripped)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

// deno-lint-ignore no-explicit-any
async function isAdmin(admin: any, uid: string): Promise<boolean> {
  const { data } = await admin
    .from('user_roles')
    .select('user_id')
    .eq('user_id', uid)
    .eq('role', 'admin')
    .maybeSingle()
  return !!data
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
// deno-lint-ignore no-explicit-any
function validatePayload(body: any): { errors: string[]; start: Date | null; end: Date | null } {
  const errors: string[] = []
  const contest = body?.contest ?? {}
  const en = body?.translations?.en ?? {}
  const ms = body?.translations?.ms ?? {}

  const title = clean(contest.title)
  if (!title) errors.push('contest.title is required')
  else if (title.length > CONTEST_LIMITS.title)
    errors.push(`contest.title exceeds ${CONTEST_LIMITS.title} chars`)

  const summary = clean(contest.summary)
  if (!summary) errors.push('contest.summary is required')
  else if (summary.length > CONTEST_LIMITS.summary)
    errors.push(`contest.summary exceeds ${CONTEST_LIMITS.summary} chars`)

  const titleMs = clean(contest.title_ms)
  if (titleMs && titleMs.length > CONTEST_LIMITS.title_ms)
    errors.push(`contest.title_ms exceeds ${CONTEST_LIMITS.title_ms} chars`)
  const summaryMs = clean(contest.summary_ms)
  if (summaryMs && summaryMs.length > CONTEST_LIMITS.summary_ms)
    errors.push(`contest.summary_ms exceeds ${CONTEST_LIMITS.summary_ms} chars`)
  const slug = clean(contest.slug)
  if (slug && slug.length > CONTEST_LIMITS.slug)
    errors.push(`contest.slug exceeds ${CONTEST_LIMITS.slug} chars`)

  const links =
    contest?.links && typeof contest.links === 'object'
      ? (contest.links as Record<string, unknown>)
      : (contest as Record<string, unknown>)
  for (const [field, aliases] of Object.entries(CONTEST_LINK_ALIASES)) {
    let val: string | null = null
    for (const key of aliases) {
      const candidate = clean(links[key])
      if (candidate) {
        val = candidate
        break
      }
    }
    const limit = CONTEST_LIMITS[field as keyof typeof CONTEST_LIMITS]
    if (val && limit) {
      if (!isHttpUrl(val)) {
        errors.push(
          `contest.links.${aliases[0]} must start with http:// or https://`,
        )
      } else if (val.length > limit) {
        errors.push(`contest.links.${aliases[0]} exceeds ${limit} chars`)
      }
    }
  }

  const start = parseDate(contest.start_date)
  if (!start) errors.push('contest.start_date is required (ISO date/time)')
  const end = parseDate(contest.end_date)
  if (!end) errors.push('contest.end_date is required (ISO date/time)')
  if (start && end && end.getTime() <= start.getTime())
    errors.push('contest.end_date must be after contest.start_date')

  // Required English translation fields.
  for (const f of REQUIRED_EN) {
    const val = clean(en[f])
    if (!val) errors.push(`translations.en.${f} is required`)
  }
  // Max-length checks for any provided translation field (en + ms).
  for (const [locale, obj] of [
    ['en', en],
    ['ms', ms],
  ] as const) {
    for (const f of TRANSLATION_FIELDS) {
      const val = clean((obj as Record<string, unknown>)[f])
      if (val) {
        if (f === 'link_tnc' || f === 'link_faq') {
          if (!isHttpUrl(val)) {
            errors.push(
              `translations.${locale}.${f} must start with http:// or https://`,
            )
          }
        }
        if (val.length > TRANSLATION_LIMITS[f]) {
          errors.push(
            `translations.${locale}.${f} exceeds ${TRANSLATION_LIMITS[f]} chars`,
          )
        }
      }
    }
  }

  // Images: shape + count.
  const images = body?.images
  if (images != null) {
    if (!Array.isArray(images)) errors.push('images must be an array')
    else if (images.length > MAX_IMAGES)
      errors.push(`images exceeds the max of ${MAX_IMAGES}`)
    else
      for (let i = 0; i < images.length; i++) {
        const im = images[i] ?? {}
        if (!im.url && !im.base64)
          errors.push(`images[${i}] must have a url or base64`)
      }
  }

  // host/category relation ids: bounded arrays of UUIDs.
  for (const [field, value] of [
    ['host_ids', body?.host_ids],
    ['category_ids', body?.category_ids],
  ] as const) {
    if (value == null) continue
    if (!Array.isArray(value)) {
      errors.push(`${field} must be an array`)
      continue
    }
    if (value.length > MAX_RELATION_IDS) {
      errors.push(`${field} exceeds the max of ${MAX_RELATION_IDS}`)
    }
    for (let i = 0; i < value.length; i++) {
      const id = String(value[i] ?? '').trim()
      if (!isUuid(id)) errors.push(`${field}[${i}] must be a UUID`)
    }
  }

  return { errors, start, end }
}

// deno-lint-ignore no-explicit-any
function buildTranslationRow(obj: any, contestId: string, locale: 'en' | 'ms') {
  const row: Record<string, unknown> = { contest_id: contestId, locale }
  for (const f of TRANSLATION_FIELDS) row[f] = clean(obj?.[f])
  return row
}

function translationRowHasContent(row: Record<string, unknown>): boolean {
  return Object.entries(row).some(
    ([k, v]) => k !== 'contest_id' && k !== 'locale' && v,
  )
}

// deno-lint-ignore no-explicit-any
function contestCoreFromPayload(contest: any, slug: string) {
  const prizesVal =
    contest.total_prizes_value_rm != null &&
    contest.total_prizes_value_rm !== ''
      ? parseFloat(String(contest.total_prizes_value_rm))
      : null
  const links = contest.links ?? contest
  return {
    title: clean(contest.title),
    title_ms: clean(contest.title_ms),
    summary: clean(contest.summary),
    summary_ms: clean(contest.summary_ms),
    start_date: new Date(contest.start_date).toISOString(),
    end_date: new Date(contest.end_date).toISOString(),
    slug,
    total_prizes_value_rm: Number.isFinite(prizesVal) ? prizesVal : null,
    // SAFETY INVARIANT: ingested contests are always drafts pending human review.
    visibility: 'admin',
    link_aff_shopee: clean(links.link_aff_shopee ?? links.aff_shopee),
    link_aff_lazada: clean(links.link_aff_lazada ?? links.aff_lazada),
    link_aff_tiktok_shop: clean(links.link_aff_tiktok_shop ?? links.aff_tiktok_shop),
    link_media_instagram: clean(links.link_media_instagram ?? links.instagram),
    link_media_facebook: clean(links.link_media_facebook ?? links.facebook),
    link_media_tiktok: clean(links.link_media_tiktok ?? links.tiktok),
    link_media_x: clean(links.link_media_x ?? links.x ?? links.twitter),
    link_media_youtube: clean(links.link_media_youtube ?? links.youtube),
    link_media_linkedin: clean(links.link_media_linkedin ?? links.linkedin),
    link_media_website: clean(links.link_media_website ?? links.website),
  }
}

// deno-lint-ignore no-explicit-any
async function ensureUniqueSlug(admin: any, base: string): Promise<string> {
  const root = (base || 'contest').slice(0, 190)
  let slug = root
  for (let n = 2; n <= 50; n++) {
    const { data } = await admin
      .from('contests')
      .select('id')
      .eq('slug', slug)
      .limit(1)
      .maybeSingle()
    if (!data) return slug
    slug = `${root}-${n}`.slice(0, 200)
  }
  return `${root}-${Date.now()}`.slice(0, 200)
}

// Fetch an image URL while following redirects MANUALLY, re-validating every hop
// against isSafePublicUrl. `redirect: 'follow'` would let a public URL bounce to
// a private/link-local target (e.g. cloud metadata at 169.254.169.254), so we
// never let fetch auto-follow. Deno exposes the 3xx Location header here.
async function safeFetchImage(startUrl: string): Promise<Response> {
  let current = startUrl
  for (let hop = 0; hop <= MAX_IMAGE_REDIRECTS; hop++) {
    if (!isSafePublicUrl(current)) {
      throw new Error(`unsafe or invalid image url: ${current}`)
    }
    const res = await fetch(current, { redirect: 'manual' })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) throw new Error(`redirect without Location from ${current}`)
      // Drain the redirect body so the connection is released before the next hop.
      try {
        await res.arrayBuffer()
      } catch (_e) {
        // ignore
      }
      current = new URL(loc, current).toString() // resolves relative redirects
      continue
    }
    return res
  }
  throw new Error('too many redirects while fetching image')
}

// deno-lint-ignore no-explicit-any
async function fetchImageBytes(
  im: any,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  if (im.base64) {
    const bytes = base64ToBytes(String(im.base64))
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error('image exceeds size limit')
    const ct = String(im.contentType || 'image/jpeg')
    if (!ct.startsWith('image/')) throw new Error(`invalid image contentType: ${ct}`)
    return { bytes, contentType: ct }
  }
  const url = String(im.url || '')
  if (!url) throw new Error('image url is empty')
  const res = await safeFetchImage(url)
  if (!res.ok) throw new Error(`image fetch failed (${res.status}) for ${url}`)
  const ct = res.headers.get('content-type') || String(im.contentType || 'image/jpeg')
  if (!ct.startsWith('image/')) throw new Error(`url is not an image (${ct})`)
  const declared = Number(res.headers.get('content-length') || '0')
  if (declared && declared > MAX_IMAGE_BYTES)
    throw new Error('image exceeds size limit')
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error('image exceeds size limit')
  return { bytes, contentType: ct }
}

// Upload gallery images and create contest_files rows. Mirrors the admin create
// flow: the main asset is uploaded first (file_order 1, label 'main-gallery')
// and set as the contest's main_img_id.
// deno-lint-ignore no-explicit-any
async function uploadImages(
  admin: any,
  contestId: string,
  slugBase: string,
  images: any[],
): Promise<void> {
  if (!images.length) return
  // Order: an explicitly-flagged main first, then by provided `order`, then
  // original position. After sorting, index 0 is the main image.
  const ordered = images
    .map((im, i) => ({ im, i }))
    .sort((a, b) => {
      const am = a.im.isMain ? 0 : 1
      const bm = b.im.isMain ? 0 : 1
      if (am !== bm) return am - bm
      const ao = Number.isFinite(a.im.order) ? Number(a.im.order) : a.i
      const bo = Number.isFinite(b.im.order) ? Number(b.im.order) : b.i
      return ao - bo
    })

  const date = new Date().toISOString().split('T')[0]
  for (let idx = 0; idx < ordered.length; idx++) {
    const { im } = ordered[idx]
    const order = idx + 1
    const isMain = idx === 0
    const { bytes, contentType } = await fetchImageBytes(im)
    const ext = extFromContentType(contentType)
    const rand = Math.random().toString(36).slice(2, 10)
    const path = `${slugify(slugBase || 'contest')}-${order}-${date}-${rand}.${ext}`

    const { error: upErr } = await admin.storage
      .from(CONTESTS_BUCKET)
      .upload(path, bytes, { contentType, upsert: false })
    if (upErr) throw new Error(`image upload failed: ${upErr.message}`)

    const { error: fErr } = await admin.from('contest_files').insert({
      contest_id: contestId,
      storage_path: path,
      label: isMain ? 'main-gallery' : 'gallery',
      file_order: order,
      width: null,
      height: null,
      blurhash: null,
    })
    if (fErr) throw new Error(`contest_files insert failed: ${fErr.message}`)

    if (isMain) {
      const { error: mErr } = await admin
        .from('contests')
        .update({ main_img_id: path, main_img_blurhash: null })
        .eq('id', contestId)
      if (mErr) throw new Error(`main image update failed: ${mErr.message}`)
    }
  }
}

// Validate the referenced host/category ids exist, then insert the junctions.
// deno-lint-ignore no-explicit-any
async function linkRelations(
  admin: any,
  contestId: string,
  table: string,
  column: string,
  refTable: string,
  ids: string[],
): Promise<void> {
  if (!ids.length) return
  const unique = [...new Set(ids)]
  const { data: found, error } = await admin
    .from(refTable)
    .select('id')
    .in('id', unique)
  if (error) throw new Error(`${refTable} lookup failed: ${error.message}`)
  const foundIds = new Set((found ?? []).map((r: { id: string }) => r.id))
  const missing = unique.filter((id) => !foundIds.has(id))
  if (missing.length) throw new Error(`${refTable} not found: ${missing.join(', ')}`)

  const { error: insErr } = await admin
    .from(table)
    .insert(unique.map((id) => ({ contest_id: contestId, [column]: id })))
  if (insErr) throw new Error(`${table} insert failed: ${insErr.message}`)
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405)
  }

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, serviceKey)

    // --- Auth: shared secret (machine editor) OR admin JWT (human admin) ---
    let authorized = false
    const ingestKey = Deno.env.get('INGEST_CONTEST_KEY')
    const providedKey = req.headers.get('x-ingest-key')
    if (ingestKey && providedKey && safeEqual(providedKey, ingestKey)) {
      authorized = true
    } else {
      const authHeader = req.headers.get('Authorization') ?? ''
      const token = authHeader.replace(/^Bearer\s+/i, '')
      if (token) {
        const userClient = createClient(url, anonKey, {
          global: { headers: { Authorization: authHeader } },
        })
        const { data: userData } = await userClient.auth.getUser()
        const uid = userData.user?.id
        if (uid && (await isAdmin(admin, uid))) authorized = true
      }
    }
    if (!authorized) return json({ success: false, error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return json({ success: false, error: 'Invalid JSON body' }, 400)
    }

    const { errors, start, end } = validatePayload(body)
    if (errors.length) {
      return json({ success: false, error: 'Validation failed', errors }, 422)
    }

    const contest = body.contest
    const en = body.translations?.en ?? {}
    const ms = body.translations?.ms ?? {}
    const images = Array.isArray(body.images) ? body.images : []
    const hostIds = Array.isArray(body.host_ids) ? body.host_ids : []
    const categoryIds = Array.isArray(body.category_ids) ? body.category_ids : []

    // Slug: use the caller's (normalized) slug, else build the app's convention.
    const providedSlug = clean(contest.slug)
    const baseSlug = providedSlug
      ? slugify(providedSlug)
      : `${slugify(contest.title)}-from-${localDate(start!)}-until-${localDate(end!)}`
    const slug = await ensureUniqueSlug(admin, baseSlug)

    // 1) Core contest row (visibility forced to 'admin').
    const { data: inserted, error: insErr } = await admin
      .from('contests')
      .insert(contestCoreFromPayload(contest, slug))
      .select('id')
      .single()
    if (insErr || !inserted) {
      return json(
        { success: false, error: 'Contest insert failed', detail: insErr?.message },
        500,
      )
    }
    const contestId = (inserted as { id: string }).id

    // 2..4) Children. On ANY failure, delete the contest (FK cascade removes the
    // partial children) so a failed ingest never leaves a half-built draft.
    try {
      await linkRelations(
        admin,
        contestId,
        'contest_hosts_map',
        'host_id',
        'contest_hosts',
        hostIds,
      )
      await linkRelations(
        admin,
        contestId,
        'contest_categories_map',
        'category_id',
        'contest_categories',
        categoryIds,
      )
      await uploadImages(admin, contestId, slug, images)

      const rows = [buildTranslationRow(en, contestId, 'en')]
      const msRow = buildTranslationRow(ms, contestId, 'ms')
      if (translationRowHasContent(msRow)) rows.push(msRow)
      const { error: tErr } = await admin.from('contest_translations').insert(rows)
      if (tErr) throw new Error(`contest_translations insert failed: ${tErr.message}`)
    } catch (e) {
      try {
        await admin.from('contests').delete().eq('id', contestId)
      } catch (_e) {
        // best-effort rollback; storage objects (if any) are harmless orphans
      }
      return json(
        { success: false, error: 'Ingest failed', detail: String((e as Error).message ?? e) },
        500,
      )
    }

    const siteUrl = (Deno.env.get('SITE_URL') || 'https://jomcontest.com').replace(
      /\/$/,
      '',
    )
    const reviewUrl = `${siteUrl}/admin?tab=edit&slug=${encodeURIComponent(slug)}`

    return json(
      { success: true, contestId, slug, visibility: 'admin', reviewUrl },
      201,
    )
  } catch (e) {
    return json(
      { success: false, error: 'Internal error', detail: String((e as Error).message ?? e) },
      500,
    )
  }
})
