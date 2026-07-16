#!/usr/bin/env node
/**
 * Regenerate Cursor ingest prompt TS exports from the markdown sources.
 *
 *   yarn sync-ingest-prompts
 *
 * Sources (edit these):
 *   supabase/functions/ingest-contest/ai-assist/direct-prompting-end-to-end/PROMPT.md
 *   supabase/functions/ingest-contest/ai-assist/direct-prompting-end-to-end/BATCH.md
 *
 * Outputs (do not edit by hand):
 *   packages/app/features/admin/contestCursorPrompt.ts
 *   packages/app/features/admin/contestCursorBatchPrompt.ts
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const TARGETS = [
  {
    markdown: path.join(
      ROOT,
      'supabase/functions/ingest-contest/ai-assist/direct-prompting-end-to-end/PROMPT.md'
    ),
    output: path.join(
      ROOT,
      'packages/app/features/admin/contestCursorPrompt.ts'
    ),
    exportName: 'CURSOR_INGEST_PROMPT',
    description:
      'Cursor / shell-equipped AI prompt: paste a campaign URL, AI fetches TnC,\n * builds contest.json, and POSTs a draft via the ingest Edge Function.',
    sourceLabel:
      'supabase/functions/ingest-contest/ai-assist/direct-prompting-end-to-end/PROMPT.md',
  },
  {
    markdown: path.join(
      ROOT,
      'supabase/functions/ingest-contest/ai-assist/direct-prompting-end-to-end/BATCH.md'
    ),
    output: path.join(
      ROOT,
      'packages/app/features/admin/contestCursorBatchPrompt.ts'
    ),
    exportName: 'CURSOR_INGEST_BATCH_PROMPT',
    description:
      'Cursor batch prompt: multiple campaign URLs in one chat turn.',
    sourceLabel:
      'supabase/functions/ingest-contest/ai-assist/direct-prompting-end-to-end/BATCH.md',
  },
]

const BEGIN = '=== BEGIN PROMPT ==='
const END = '=== END PROMPT ==='

function extractPrompt(markdown, sourcePath) {
  const lines = markdown.split('\n')
  let inside = false
  const body = []

  for (const line of lines) {
    if (line === BEGIN) {
      inside = true
      continue
    }
    if (line === END) {
      if (!inside) {
        throw new Error(`${sourcePath}: found ${END} without ${BEGIN}`)
      }
      return body.join('\n')
    }
    if (inside) {
      body.push(line)
    }
  }

  throw new Error(`${sourcePath}: missing ${BEGIN} … ${END} block`)
}

function escapeForTemplateLiteral(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
}

function buildTsFile({ exportName, description, sourceLabel, body }) {
  return `/**
 * ${description}
 *
 * AUTO-GENERATED — do not edit by hand. Run \`yarn sync-ingest-prompts\`.
 * Source: ${sourceLabel}
 * (the fenced block between BEGIN/END PROMPT).
 */

export const ${exportName} = \`${escapeForTemplateLiteral(body)}\`
`
}

function syncTarget(target) {
  const markdown = fs.readFileSync(target.markdown, 'utf8')
  const body = extractPrompt(markdown, target.markdown)
  const next = buildTsFile({ ...target, body })
  const prev = fs.existsSync(target.output)
    ? fs.readFileSync(target.output, 'utf8')
    : null

  if (prev === next) {
    console.log(`unchanged  ${path.relative(ROOT, target.output)}`)
    return false
  }

  fs.writeFileSync(target.output, next)
  console.log(`updated    ${path.relative(ROOT, target.output)}`)
  return true
}

let changed = 0
for (const target of TARGETS) {
  if (syncTarget(target)) changed += 1
}

if (changed === 0) {
  console.log('All ingest prompt exports are already in sync.')
} else {
  console.log(`Synced ${changed} file(s).`)
}
