/**
 * Pure utilities for importing a contest from the ingest-contest JSON payload —
 * the exact same shape OpenClaw (or a browser chatbot given the "Copy AI
 * Prompt" prompt) produces and the `ingest-contest` Edge Function accepts
 * (see supabase/functions/ingest-contest/README.md).
 *
 * Used by the admin "Create Contest" tab so an admin can import a .json file
 * or paste JSON from the clipboard and auto-populate every form field.
 *
 * Not importable via the form (surfaced as warnings instead):
 *   - `images`      → uploaded manually via the gallery picker
 *   - `host_ids` / `category_ids` → picked manually in the form
 *   - `visibility`  → chosen in the form (the Edge Function forces 'admin')
 */

import type { CreateContestFormData } from './createContestSchema'

// ---------- Field configuration ----------------------------------------------

// Bilingual translation field bases: `translations.en.<base>` → `<base>_en`.
export const TRANSLATION_BASES = [
  'eligible_participants',
  'eligible_participants_exclusion',
  'eligible_products',
  'eligible_stores',
  'prizes',
  'entry_method',
  'winners_selection_method',
  'winners_comm_and_timeline',
  'winners_list_and_announcement',
  'link_tnc',
  'link_faq',
] as const

// English translation fields the form requires (match createContestSchema.ts).
const REQUIRED_EN_BASES = [
  'eligible_participants',
  'eligible_products',
  'eligible_stores',
  'prizes',
  'entry_method',
  'winners_selection_method',
  'winners_comm_and_timeline',
  'winners_list_and_announcement',
] as const

// `contest.links` JSON keys → form fields. Accepts both the long form-field
// names and the short aliases the Edge Function accepts.
const LINK_KEY_MAP: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['link_aff_shopee', ['link_aff_shopee', 'aff_shopee']],
  ['link_aff_lazada', ['link_aff_lazada', 'aff_lazada']],
  ['link_aff_tiktok_shop', ['link_aff_tiktok_shop', 'aff_tiktok_shop']],
  ['link_media_instagram', ['link_media_instagram', 'instagram']],
  ['link_media_facebook', ['link_media_facebook', 'facebook']],
  ['link_media_tiktok', ['link_media_tiktok', 'tiktok']],
  ['link_media_x', ['link_media_x', 'x', 'twitter']],
  ['link_media_youtube', ['link_media_youtube', 'youtube']],
  ['link_media_linkedin', ['link_media_linkedin', 'linkedin']],
  ['link_media_website', ['link_media_website', 'website']],
] as const

// Max lengths kept in sync with createContestSchema.ts. If you change a
// maxLength in the schema, change it here too.
export const FIELD_LIMITS: Record<string, number> = {
  title: 100,
  title_ms: 100,
  summary: 200,
  summary_ms: 200,
  slug: 200,
  eligible_participants_en: 1500,
  eligible_participants_ms: 1500,
  eligible_participants_exclusion_en: 1000,
  eligible_participants_exclusion_ms: 1000,
  eligible_products_en: 2400,
  eligible_products_ms: 2400,
  eligible_stores_en: 2000,
  eligible_stores_ms: 2000,
  prizes_en: 2000,
  prizes_ms: 2000,
  entry_method_en: 2000,
  entry_method_ms: 2000,
  winners_selection_method_en: 2000,
  winners_selection_method_ms: 2000,
  winners_comm_and_timeline_en: 1500,
  winners_comm_and_timeline_ms: 1500,
  winners_list_and_announcement_en: 1000,
  winners_list_and_announcement_ms: 1000,
  link_tnc_en: 300,
  link_tnc_ms: 300,
  link_faq_en: 300,
  link_faq_ms: 300,
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

/**
 * Fields the importer can overwrite — used by the Create tab to decide
 * whether to show the "overwrite existing content?" confirmation. Dates and
 * slug are excluded because they always carry generated defaults.
 */
export const CONTEST_JSON_TEXT_KEYS: string[] = [
  'title',
  'title_ms',
  'summary',
  'summary_ms',
  'total_prizes_value_rm',
  ...TRANSLATION_BASES.flatMap((b) => [`${b}_en`, `${b}_ms`]),
  ...LINK_KEY_MAP.map(([formKey]) => formKey),
]

// ---------- Public types -----------------------------------------------------

export type ParseReport = {
  /** Form values ready to feed into react-hook-form's setValue. */
  values: Partial<CreateContestFormData>
  /** Field names successfully populated. */
  filled: string[]
  /** Required/expected fields that were missing or blank in the JSON. */
  missing: string[]
  /** Fields exceeding FIELD_LIMITS (we still pass full content; the form's own validator surfaces the red error). */
  overLimit: { field: string; chars: number; limit: number }[]
  /** Keys present in the JSON that aren't recognized. */
  unknownSections: string[]
  /** Non-fatal informational notices. */
  warnings: string[]
  /** Fatal issues — caller should abort the import. */
  errors: string[]
}

// ---------- Parser -----------------------------------------------------------

/**
 * Parse an ingest-contest JSON payload (string) into form values.
 * Tolerates a payload wrapped in a ```json code fence or surrounding prose
 * (common when copying straight out of a chatbot). Never throws — all
 * problems are surfaced through the report.
 */
export function parseContestJson(raw: string): ParseReport {
  const report: ParseReport = {
    values: {},
    filled: [],
    missing: [],
    overLimit: [],
    unknownSections: [],
    warnings: [],
    errors: [],
  }

  if (!raw || !raw.trim()) {
    report.errors.push('The file/clipboard is empty.')
    return report
  }

  // Guard: the admin pasted the AI prompt itself (e.g. clicked "Copy AI
  // Prompt" then "Paste JSON"). The prompt's STRUCTURE example is extractable
  // JSON, so without this check we would "import" its placeholder strings.
  if (raw.includes('You are the contest-ingestion editor')) {
    report.errors.push(
      'This is the AI prompt itself, not contest data — paste the JSON the chatbot returned instead.'
    )
    return report
  }

  const body = tryParseJsonObject(raw)
  if (!body) {
    report.errors.push(
      'Not valid JSON — expected the contest payload produced by the AI prompt (a single JSON object).'
    )
    return report
  }

  // Accept `{ contest: {...}, translations: {...} }` (canonical) or a payload
  // the LLM flattened to the contest object itself.
  const contest =
    body.contest && typeof body.contest === 'object'
      ? (body.contest as Record<string, unknown>)
      : typeof body.title === 'string'
        ? body
        : null
  if (!contest) {
    report.errors.push('JSON has no "contest" object.')
    return report
  }

  // ----- Core scalars --------------------------------------------------------
  const title = cleanStr(contest.title)
  if (title) assignWithLimit(report, 'title', title)
  else report.missing.push('title')

  const titleMs = cleanStr(contest.title_ms)
  if (titleMs) assignWithLimit(report, 'title_ms', titleMs)

  const summary = cleanStr(contest.summary)
  if (summary) assignWithLimit(report, 'summary', summary)
  else report.missing.push('summary')

  const summaryMs = cleanStr(contest.summary_ms)
  if (summaryMs) assignWithLimit(report, 'summary_ms', summaryMs)

  const slug = cleanStr(contest.slug)
  if (slug) assignWithLimit(report, 'slug', slug)

  const totalRaw = contest.total_prizes_value_rm
  if (totalRaw !== undefined && totalRaw !== null && totalRaw !== '') {
    const num = parseMoney(String(totalRaw))
    if (num === null) {
      report.warnings.push(
        `total_prizes_value_rm: could not parse "${String(totalRaw)}", left blank.`
      )
    } else {
      ;(report.values as any).total_prizes_value_rm = String(num)
      report.filled.push('total_prizes_value_rm')
    }
  }

  // ----- Dates ---------------------------------------------------------------
  for (const key of ['start_date', 'end_date'] as const) {
    const iso = cleanStr(contest[key])
    if (!iso) {
      report.missing.push(key)
      continue
    }
    const local = isoToFormDateTime(iso)
    if (local) {
      ;(report.values as any)[key] = local
      report.filled.push(key)
    } else {
      report.warnings.push(
        `${key}: could not parse "${iso}" as ISO 8601 — left blank.`
      )
    }
  }

  // ----- Links (nested `contest.links` or flat on the contest object) --------
  const linksObj =
    contest.links && typeof contest.links === 'object'
      ? (contest.links as Record<string, unknown>)
      : contest
  for (const [formKey, jsonKeys] of LINK_KEY_MAP) {
    for (const jk of jsonKeys) {
      const val = cleanStr(linksObj[jk])
      if (val) {
        assignWithLimit(report, formKey, val)
        break
      }
    }
  }

  // ----- Translations --------------------------------------------------------
  const translations =
    body.translations && typeof body.translations === 'object'
      ? (body.translations as Record<string, unknown>)
      : {}
  for (const locale of ['en', 'ms'] as const) {
    const obj =
      translations[locale] && typeof translations[locale] === 'object'
        ? (translations[locale] as Record<string, unknown>)
        : {}
    for (const base of TRANSLATION_BASES) {
      const val = cleanStr(obj[base])
      if (val) assignWithLimit(report, `${base}_${locale}`, val)
    }
    for (const k of Object.keys(obj)) {
      if (!(TRANSLATION_BASES as readonly string[]).includes(k)) {
        report.unknownSections.push(`translations.${locale}.${k}`)
      }
    }
  }
  for (const base of REQUIRED_EN_BASES) {
    if (!report.filled.includes(`${base}_en`)) report.missing.push(`${base}_en`)
  }

  // ----- Non-importable extras ------------------------------------------------
  const images = body.images
  if (Array.isArray(images) && images.length > 0) {
    report.warnings.push(
      `${images.length} image${images.length === 1 ? '' : 's'} in the JSON ${
        images.length === 1 ? 'is' : 'are'
      } not imported — add images via the gallery picker below.`
    )
  }
  if (
    (Array.isArray(body.host_ids) && body.host_ids.length > 0) ||
    (Array.isArray(body.category_ids) && body.category_ids.length > 0)
  ) {
    report.warnings.push(
      'host_ids/category_ids are not imported — pick hosts and categories manually.'
    )
  }

  const KNOWN_ROOT_KEYS = [
    'contest',
    'translations',
    'images',
    'host_ids',
    'category_ids',
  ]
  if (body.contest && typeof body.contest === 'object') {
    for (const k of Object.keys(body)) {
      if (!KNOWN_ROOT_KEYS.includes(k)) report.unknownSections.push(k)
    }
  }

  return report
}

// ---------- Internal helpers -------------------------------------------------

/**
 * Parse a JSON object out of raw text. Strips ```json fences; if direct
 * parsing fails, falls back to the substring between the first `{` and the
 * last `}` (chatbots often wrap the payload in prose).
 */
function tryParseJsonObject(raw: string): Record<string, unknown> | null {
  const attempts: string[] = []
  const trimmed = raw.trim()
  attempts.push(trimmed)

  const unfenced = trimmed
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .trim()
  if (unfenced !== trimmed) attempts.push(unfenced)

  const first = raw.indexOf('{')
  const last = raw.lastIndexOf('}')
  if (first >= 0 && last > first) attempts.push(raw.slice(first, last + 1))

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // try the next candidate
    }
  }
  return null
}

function cleanStr(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s.length ? s : null
}

function assignWithLimit(report: ParseReport, field: string, value: string) {
  ;(report.values as any)[field] = value
  report.filled.push(field)
  const limit = FIELD_LIMITS[field]
  if (limit !== undefined && value.length > limit) {
    report.overLimit.push({ field, chars: value.length, limit })
  }
}

function parseMoney(s: string): number | null {
  // Accept "10000", "10,000", "RM10,000.50", "10_000", "MYR 10000".
  const cleaned = s.replace(/[Rr][Mm]|MYR|myr/g, '').replace(/[,\s_]/g, '')
  const n = parseFloat(cleaned)
  if (!isFinite(n)) return null
  return n
}

// Malaysia time is fixed at UTC+08:00 (no DST). Centralizing the offset means
// every consumed date string is unambiguously MYT regardless of the admin's
// machine timezone.
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000

/**
 * Convert an ISO 8601 instant into the form-expected `YYYY-MM-DDTHH:mm:ss`
 * string, evaluated in Malaysia time. If the input lacks a `Z`/offset, we
 * assume MYT so slightly-malformed LLM output stays deterministic instead of
 * silently host-TZ-dependent.
 */
function isoToFormDateTime(iso: string): string | null {
  const normalized = ensureMytOffset(iso.trim())
  const d = new Date(normalized)
  if (isNaN(d.getTime())) return null
  const shifted = new Date(d.getTime() + MYT_OFFSET_MS)
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(
    shifted.getUTCDate()
  )}T${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}:${pad2(
    shifted.getUTCSeconds()
  )}`
}

function ensureMytOffset(s: string): string {
  // Already has Z or ±HH:MM / ±HHMM at the end?
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(s)) return s
  // Naive datetime "YYYY-MM-DDTHH:mm[:ss]" → assume MYT
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(s)) return `${s}+08:00`
  // Date-only "YYYY-MM-DD" → assume midnight MYT
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00+08:00`
  return s
}
