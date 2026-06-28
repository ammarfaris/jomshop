/**
 * Pure utilities for importing and exporting a contest as a Markdown file
 * with YAML-style front matter. Used by the admin "Create / Edit Contest"
 * tabs so an admin can drop in a single .md (typically generated from a T&C
 * PDF via an LLM) and auto-populate every form field.
 *
 * The file shape is locked: front matter for typed metadata, then 18 sections
 * keyed by the *exact* form field names in `createContestSchema.ts`. This
 * keeps parsing robust regardless of how the LLM phrases the human-friendly
 * titles.
 */

import type { CreateContestFormData } from './createContestSchema'

// ---------- Field configuration ----------------------------------------------

// Section keys that map 1:1 to bilingual textarea fields in the form.
// Order matters: it's the order in which we render them in the template
// generator and (when we surface a parse report) the order we walk through.
export const CONTEST_MD_SECTION_KEYS = [
  'eligible_participants_en',
  'eligible_participants_ms',
  'eligible_participants_exclusion_en',
  'eligible_participants_exclusion_ms',
  'eligible_products_en',
  'eligible_products_ms',
  'eligible_stores_en',
  'eligible_stores_ms',
  'prizes_en',
  'prizes_ms',
  'entry_method_en',
  'entry_method_ms',
  'winners_selection_method_en',
  'winners_selection_method_ms',
  'winners_comm_and_timeline_en',
  'winners_comm_and_timeline_ms',
  'winners_list_and_announcement_en',
  'winners_list_and_announcement_ms',
] as const

export type ContestMdSectionKey = (typeof CONTEST_MD_SECTION_KEYS)[number]

// All known form fields the parser is allowed to populate, with their
// `valibot` maxLength constraints kept in sync with createContestSchema.ts.
// If you change a maxLength in the schema, change it here too.
export const FIELD_LIMITS: Record<string, number> = {
  // Front-matter scalars
  title: 100,
  title_ms: 100,
  summary: 200,
  summary_ms: 200,
  // Section bodies
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
}

// ---------- Public types -----------------------------------------------------

export type ParseReport = {
  /** Form values ready to feed into react-hook-form's setValue. */
  values: Partial<CreateContestFormData>
  /** Field names successfully populated. */
  filled: string[]
  /** Required/expected fields that were missing or blank in the .md. */
  missing: string[]
  /** Sections that exceeded FIELD_LIMITS (we still pass full content; the form's own validator surfaces the red error). */
  overLimit: { field: string; chars: number; limit: number }[]
  /** Section keys present in the .md that aren't recognized form fields. */
  unknownSections: string[]
  /** Non-fatal informational notices. */
  warnings: string[]
  /** Fatal issues — caller should abort the import. */
  errors: string[]
}

// ---------- Parser -----------------------------------------------------------

/**
 * Parse a contest .md file (front matter + 18 ## sections).
 * Never throws — all problems are surfaced through the report.
 */
export function parseContestMarkdown(raw: string): ParseReport {
  const report: ParseReport = {
    values: {},
    filled: [],
    missing: [],
    overLimit: [],
    unknownSections: [],
    warnings: [],
    errors: [],
  }

  if (!raw || typeof raw !== 'string') {
    report.errors.push('File is empty or unreadable.')
    return report
  }

  // Normalize line endings + strip BOM.
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')

  // ----- Front matter ------------------------------------------------------
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n?/)
  const front: Record<string, string | null> = {}
  let body = text
  if (fmMatch) {
    parseFrontMatter(fmMatch[1] ?? '', front, report)
    body = text.slice(fmMatch[0].length)
  } else {
    report.warnings.push(
      'No YAML front matter found — title, summary, dates, and total prize value will not be imported.'
    )
  }

  // Map front-matter keys → form keys. We accept both `title_en`/`summary_en`
  // (symmetric with the _ms variants in the canonical template) and the raw
  // form names `title`/`summary`. When reporting `missing`, we always use the
  // form-schema field names so the entries in `report.missing` line up 1:1
  // with the actual form fields the admin sees in the UI (e.g. `title`,
  // `summary`, `start_date`, `eligible_participants_en`, ...).
  const titleEn = pickStr(front, ['title_en', 'title'])
  const titleMs = pickStr(front, ['title_ms'])
  const summaryEn = pickStr(front, ['summary_en', 'summary'])
  const summaryMs = pickStr(front, ['summary_ms'])
  const totalRm = pickStr(front, ['total_prizes_value_rm'])
  const startIso = pickStr(front, ['start_date'])
  const endIso = pickStr(front, ['end_date'])

  if (titleEn) assignWithLimit(report, 'title', titleEn)
  else if (fmMatch) report.missing.push('title')

  if (titleMs) assignWithLimit(report, 'title_ms', titleMs)

  if (summaryEn) assignWithLimit(report, 'summary', summaryEn)
  else if (fmMatch) report.missing.push('summary')

  if (summaryMs) assignWithLimit(report, 'summary_ms', summaryMs)

  if (totalRm !== null && totalRm !== undefined && totalRm !== '') {
    const num = parseMoney(totalRm)
    if (num === null) {
      report.warnings.push(
        `total_prizes_value_rm: could not parse "${totalRm}", left blank.`
      )
    } else {
      ;(report.values as any).total_prizes_value_rm = String(num)
      report.filled.push('total_prizes_value_rm')
    }
  }

  if (startIso) {
    const local = isoToFormDateTime(startIso)
    if (local) {
      ;(report.values as any).start_date = local
      report.filled.push('start_date')
    } else {
      report.warnings.push(
        `start_date: could not parse "${startIso}" as ISO 8601 — left blank.`
      )
    }
  } else if (fmMatch) {
    report.missing.push('start_date')
  }

  if (endIso) {
    const local = isoToFormDateTime(endIso)
    if (local) {
      ;(report.values as any).end_date = local
      report.filled.push('end_date')
    } else {
      report.warnings.push(
        `end_date: could not parse "${endIso}" as ISO 8601 — left blank.`
      )
    }
  } else if (fmMatch) {
    report.missing.push('end_date')
  }

  // ----- Body sections -----------------------------------------------------
  const sectionRe = /^##[ \t]+([a-z0-9_]+)[ \t]*$/gm
  const matches: { key: string; headingStart: number; afterHeading: number }[] =
    []
  let m: RegExpExecArray | null
  while ((m = sectionRe.exec(body)) !== null) {
    matches.push({
      key: m[1] ?? '',
      headingStart: m.index,
      afterHeading: m.index + m[0].length,
    })
  }

  if (matches.length === 0) {
    report.errors.push(
      'No "## section" headings found in the file. Did you mean to upload the right .md?'
    )
    return report
  }

  const seen = new Set<string>()
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i]
    if (!cur) continue
    const next = matches[i + 1]
    const sliceEnd = next ? next.headingStart : body.length
    const slice = body.slice(cur.afterHeading, sliceEnd)
    const content = trimSectionBody(slice)
    if (seen.has(cur.key)) {
      report.warnings.push(`Duplicate "## ${cur.key}" — kept the first occurrence.`)
      continue
    }
    seen.add(cur.key)

    if (!FIELD_LIMITS.hasOwnProperty(cur.key) && !CONTEST_MD_SECTION_KEYS.includes(cur.key as ContestMdSectionKey)) {
      report.unknownSections.push(cur.key)
      continue
    }
    if (!content) {
      report.missing.push(cur.key)
      continue
    }
    assignWithLimit(report, cur.key, content)
  }

  // Any required section not present at all → record as missing
  for (const k of CONTEST_MD_SECTION_KEYS) {
    if (!seen.has(k) && !report.missing.includes(k)) {
      // Only record _en (required) variants as missing; _ms are optional in valibot.
      if (k.endsWith('_en')) report.missing.push(k)
    }
  }

  return report
}

// ---------- Template builder -------------------------------------------------

export function buildContestMarkdownTemplate(): string {
  // Build dates relative to "today" in Malaysia time (MYT, +08:00) so the
  // generated template is identical regardless of the admin's machine timezone.
  const todayMyt = getMytParts(new Date())
  const startIso = formatMytIso(
    todayMyt.year,
    todayMyt.month,
    todayMyt.day,
    0,
    0,
    0
  )
  // "+3 months" using UTC math on MYT components avoids local-time DST edge cases.
  const endUtc = new Date(
    Date.UTC(todayMyt.year, todayMyt.month + 3, todayMyt.day)
  )
  const endIso = formatMytIso(
    endUtc.getUTCFullYear(),
    endUtc.getUTCMonth(),
    endUtc.getUTCDate(),
    23,
    59,
    0
  )

  const sectionPlaceholder = (key: ContestMdSectionKey) =>
    `## ${key}\n<!-- ${FIELD_LIMITS[key]} chars max -->\n\n`

  const front = `---
title_en: ""              # ≤100 chars
title_ms: ""              # ≤100 chars
summary_en: ""            # ≤200 chars (focus on prizes + how to win + dates if room)
summary_ms: ""            # ≤200 chars
total_prizes_value_rm: null   # number e.g. 10000.50, or null if not stated
start_date: ${startIso}
end_date:   ${endIso}
---

`
  const sections = CONTEST_MD_SECTION_KEYS.map(sectionPlaceholder).join('')
  return front + sections
}

// ---------- Internal helpers -------------------------------------------------

function parseFrontMatter(
  src: string,
  out: Record<string, string | null>,
  report: ParseReport
) {
  const lines = src.split('\n')
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+#.*$/, '') // strip inline comments (only when preceded by whitespace, so `#` inside a quoted URL is preserved)
    if (!line.trim()) continue
    if (line.trim().startsWith('#')) continue
    const idx = line.indexOf(':')
    if (idx < 0) {
      report.warnings.push(`Front matter line ignored (no ":"): ${rawLine}`)
      continue
    }
    const key = line.slice(0, idx).trim()
    let value: string | null = line.slice(idx + 1).trim()
    if (value === '' || value === '~' || value.toLowerCase() === 'null') {
      value = null
    } else {
      // strip wrapping quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
    }
    out[key] = value
  }
}

function pickStr(
  obj: Record<string, string | null>,
  keys: string[]
): string | null {
  for (const k of keys) {
    if (k in obj) return obj[k] ?? null
  }
  return null
}

function assignWithLimit(report: ParseReport, field: string, raw: string) {
  const value = raw
  ;(report.values as any)[field] = value
  report.filled.push(field)
  const limit = FIELD_LIMITS[field]
  if (limit !== undefined && value.length > limit) {
    report.overLimit.push({ field, chars: value.length, limit })
  }
}

function trimSectionBody(s: string): string {
  // Drop leading newlines after the heading and trailing whitespace before the next section.
  return s.replace(/^\n+/, '').replace(/\s+$/, '')
}

function parseMoney(s: string): number | null {
  // Accept "10000", "10,000", "RM10,000.50", "10_000", "MYR 10000".
  const cleaned = s.replace(/[Rr][Mm]|MYR|myr/g, '').replace(/[,\s_]/g, '')
  const n = parseFloat(cleaned)
  if (!isFinite(n)) return null
  return n
}

// Malaysia time is fixed at UTC+08:00 (no DST). Centralizing the offset means
// every produced/consumed date string is unambiguously MYT regardless of the
// admin's machine timezone.
const MYT_OFFSET_MIN = 8 * 60
const MYT_OFFSET_MS = MYT_OFFSET_MIN * 60 * 1000

/**
 * Convert an ISO 8601 instant into the form-expected `YYYY-MM-DDTHH:mm:ss`
 * string, evaluated in Malaysia time. The same instant produces the same
 * string in any machine timezone.
 *
 * If the input lacks a UTC designator (`Z`) or numeric offset (`±HH:MM`), we
 * assume Malaysia time (+08:00). This keeps slightly-malformed LLM output
 * deterministic instead of silently host-TZ-dependent.
 */
function isoToFormDateTime(iso: string): string | null {
  const normalized = ensureMytOffset(iso.trim())
  const d = new Date(normalized)
  if (isNaN(d.getTime())) return null
  const t = getMytParts(d)
  return formatLocalNoOffset(t.year, t.month, t.day, t.hours, t.minutes, t.seconds)
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

/**
 * Decompose a Date into year/month/day/hours/minutes/seconds as observed in
 * Malaysia time. We shift the underlying instant by +08:00 and read the UTC
 * components — that bypasses the host's local timezone entirely.
 */
function getMytParts(d: Date): {
  year: number
  month: number // 0-based
  day: number
  hours: number
  minutes: number
  seconds: number
} {
  const shifted = new Date(d.getTime() + MYT_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
  }
}

const pad2 = (n: number) => String(n).padStart(2, '0')

function formatLocalNoOffset(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number
): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}T${pad2(hours)}:${pad2(
    minutes
  )}:${pad2(seconds)}`
}

function formatMytIso(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number
): string {
  return `${formatLocalNoOffset(year, month, day, hours, minutes, seconds)}+08:00`
}
