# Perplexity Instructions — Contest T&C → Importable .md

You are converting an attached Malaysian consumer-contest T&C (PDF) into a single `.md`
file that an automated importer in our admin panel will parse. Output MUST be
deterministic; every key and structure is REQUIRED.

## Inputs you will receive

1. **This file** (`perplexity-instructions.md`) — the rules.
2. **`contest-template.md`** — the empty schema you must fill in. Do not change keys,
   ordering, or the `##` heading style. Replace each `<!-- N chars max -->` comment with
   the actual content for that section.
3. **The contest T&C PDF** for the campaign you are processing.

## Deliverable

Use Python to write a file named `contest-import.md` whose structure is **identical**
to `contest-template.md` (front matter + 18 `##` sections, in the same order).
Make the file available for download.

## Front-matter rules

- `title_en` / `title_ms`: official campaign name. ≤100 chars each. Wrap in double quotes.
- `summary_en` / `summary_ms`: 180–200 chars (NEVER more than 200). Focus on **prizes +
  how to win + dates** if you have room. EXCLUDE eligibility info ("Open to Malaysians",
  "Aged 18+", etc.). Wrap in double quotes. Append the actual character count as an
  inline comment, e.g. `summary_en: "..."  # 198 chars`.
- `total_prizes_value_rm`: number only (e.g. `10000.50`). Use `null` if not stated.
- `start_date` / `end_date`: ISO 8601 with `+08:00` (Malaysia time). If only a date is
  given in the PDF, use `T00:00:00+08:00` for start and `T23:59:00+08:00` for end.

## Body section rules

- Use **Bahasa MALAYSIA** for every `_ms` field (NOT Bahasa Indonesia). Translate from
  the source language if the PDF only contains one language.
- Respect the `<!-- N chars max -->` limit shown above each section in the template.
  If you can't fit the content, summarise — never just truncate mid-sentence.
- Inside a section body you MAY use markdown freely: bold, italics, lists, tables,
  links, emoji where helpful.
- Inside a section body you MUST NOT use `##` headings. Only `###` and smaller.
- Do not repeat the human-readable section title inside the body.
- If a section's information is genuinely not in the T&C, replace the placeholder
  with exactly one line:
  - English variant: `Not specified in the T&C.`
  - Bahasa Malaysia variant: `Tidak dinyatakan dalam T&C.`

## After the .md file, also output a short plain-text appendix

Label it `META:` and include:

1. Campaign name (English + Bahasa Malaysia)
2. Total value of prizes (or "Not mentioned")
3. Start date & time, end date & time, and source timezone

## Self-check before delivering

Verify the generated `contest-import.md` passes all of these:

- Starts with `---` and contains a closing `---` line for the front matter.
- Contains exactly these 18 `## ` headings, in this order:
  `eligible_participants_en`, `eligible_participants_ms`,
  `eligible_participants_exclusion_en`, `eligible_participants_exclusion_ms`,
  `eligible_products_en`, `eligible_products_ms`,
  `eligible_stores_en`, `eligible_stores_ms`,
  `prizes_en`, `prizes_ms`,
  `entry_method_en`, `entry_method_ms`,
  `winners_selection_method_en`, `winners_selection_method_ms`,
  `winners_comm_and_timeline_en`, `winners_comm_and_timeline_ms`,
  `winners_list_and_announcement_en`, `winners_list_and_announcement_ms`.
- `summary_en` and `summary_ms` are each ≤200 chars.
- No section body uses `##` (only `###` or smaller).
- No leftover `<!-- N chars max -->` comments — every one has been replaced with real
  content (or with the "Not specified" sentence).

If any check fails, fix the file before producing the download link.
