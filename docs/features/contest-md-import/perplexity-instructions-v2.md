# Perplexity Instructions v2 — Contest T&C → Importable .md (Rich Markdown)

You are converting an attached Malaysian consumer-contest T&C (PDF) into a single
`.md` file that an automated importer in our admin panel will parse. Output MUST
be deterministic; every key and structure is REQUIRED.

This is the **rich-markdown variant** of the instructions. Unlike the plain
version, here we *actively encourage* using GitHub-flavoured markdown features
(tables, bullet/numbered lists, emphasis, ✨ minimal taste-level emoji) inside
each section's body — because the admin panel renders these properly via its
custom `MarkdownText` component when the contest is shown to end users.

## Inputs you will receive

1. **This file** (`perplexity-instructions-v2.md`) — the rules.
2. **`contest-template.md`** — the empty schema you must fill in. Do not change
   keys, ordering, or the `##` heading style. Replace each
   `<!-- N chars max -->` comment with the actual content for that section.
3. **The contest T&C PDF** for the campaign you are processing.

## Deliverable

Use Python to write a file named `contest-import.md` whose structure is
**identical** to `contest-template.md` (front matter + 18 `##` sections, in the
same order). Make the file available for download.

## Front-matter rules (unchanged from v1)

- `title_en` / `title_ms`: official campaign name. ≤100 chars each. Wrap in double quotes.
- `summary_en` / `summary_ms`: 180–200 chars (NEVER more than 200). Focus on
  **prizes + how to win + dates** if you have room. EXCLUDE eligibility info
  ("Open to Malaysians", "Aged 18+", etc.). Wrap in double quotes. Append the
  actual character count as an inline comment, e.g.
  `summary_en: "..."  # 198 chars`.
  Light emoji are welcome here too if they help readability — e.g.
  `summary_en: "🏆 Win RM10,000 in gold! Buy any Dutch Lady RM10+ between 1 Apr–30 Jun and submit your receipt."  # 132 chars`.
- `total_prizes_value_rm`: number only (e.g. `10000.50`). Use `null` if not stated.
- `start_date` / `end_date`: ISO 8601 with `+08:00` (Malaysia time). If only a
  date is given in the PDF, use `T00:00:00+08:00` for start and
  `T23:59:00+08:00` for end.

## What the renderer supports inside a section body

The admin uses a custom markdown renderer that supports **all of the following**.
Use them where they make the content easier to scan:

| Feature | Syntax | Notes |
|---|---|---|
| Bold | `**text**` | For totals, dates, prize names |
| Italic | `*text*` or `_text_` | Sparingly, for emphasis |
| Bold-italic | `***text***` | For the most important callouts |
| Bullet list | `- item` or `* item` | Default for short item enumerations |
| Numbered list | `1. step` | Use for *ordered* steps (e.g. how-to-enter) |
| Heading (h3+) | `### Sub-heading` | NEVER use `##` inside a section |
| Horizontal rule | `---` | To split visual groups |
| Inline code | `` `code` `` | Use only for codes / SKUs / hashtags |
| Fenced code block | triple-backtick | Useful only when escaping content |
| Links | `[label](https://…)` | OK for offsite references |
| Tables | `\| col \| col \|` + `\| --- \| --- \|` | **Strongly encouraged for prizes / products / stores / timeline** |

## Body section rules

- Use **Bahasa MALAYSIA** for every `_ms` field (NOT Bahasa Indonesia).
  Translate from the source language if the PDF only contains one language.
- Respect the `<!-- N chars max -->` limit shown above each section. If you
  can't fit the content, summarise — never just truncate mid-sentence.
- Inside a section body you MUST NOT use `##` headings. Only `###` and smaller.
- Do not repeat the human-readable section title inside the body.
- If a section's information is genuinely not in the T&C, replace the
  placeholder with exactly one line:
  - English: `Not specified in the T&C.`
  - Bahasa Malaysia: `Tidak dinyatakan dalam T&C.`

### Emoji guidance (minimal but useful)

A *small* set of well-placed emoji speeds up scanning. Use them at the **start
of a line** (like a bullet glyph) or before a heading — not scattered through
prose. Pick from the table below; do not invent new ones.

| Theme | Suggested emoji | Use in |
|---|---|---|
| Prizes / Winning | 🏆 🎁 🥇 🥈 🥉 | `prizes_*`, `summary_*` |
| Money / Value | 💰 💵 | `prizes_*`, `total_prizes_value_rm` callouts |
| Dates / Timeline | 📅 ⏰ | `entry_method_*`, `winners_comm_and_timeline_*` |
| Eligibility (✅ / ❌) | ✅ ❌ | `eligible_*`, `eligible_participants_exclusion_*` |
| Stores / Locations | 🏬 📍 | `eligible_stores_*` |
| How to enter | 📝 📤 🧾 | `entry_method_*` |
| Communication | 📧 📞 💬 | `winners_comm_and_timeline_*` |
| Announcement | 📣 📢 | `winners_list_and_announcement_*` |

Do **not** use emoji as decoration on every line. One emoji per `###`
sub-heading or per top-level bullet group is plenty.

### Tables (strongly preferred for tabular content)

Whenever the T&C presents structured data, render it as a markdown table —
the admin renderer will display it as a real table with alignment.

Examples of where tables shine:

- `prizes_*` — quantity / prize / value / draw type
- `eligible_products_*` — brand / SKU / minimum spend
- `eligible_stores_*` — channel / chain / region
- `winners_comm_and_timeline_*` — milestone / date / channel

## Concrete content examples (good vs bad)

### `prizes_en` — good

```
🏆 **Total prize pool worth RM 100,000.**

| Tier | Quantity | Prize | Approx. Value (RM) |
| --- | ---: | --- | ---: |
| Grand | 1 | 50g Public Gold bar 999.9 | 30,000 |
| First | 5 | RM2,000 Touch ’n Go eWallet credit | 10,000 |
| Consolation | 50 | RM200 Dutch Lady hamper | 10,000 |

### Limit per participant
- Each NRIC may win **at most one prize tier** during the contest.
- Late entries (after `2026-06-30 23:59 MYT`) are invalid.
```

### `prizes_en` — bad (don't do this)

```
- Grand prize is gold bar 50g 999.9 worth around RM30000
- First prizes are RM2000 each x 5 winners totaling RM10000
- 50 consolation winners each get a hamper worth RM200
```
*(Same info, no structure — the admin sees a wall of text. Use a table.)*

### `entry_method_en` — good

```
📝 To enter:

1. Buy any **Dutch Lady** product worth **RM10 and above** in a single receipt.
2. Snap a photo of the receipt — full receipt visible, store name legible.
3. Upload it via [`jomcontest.com/buy-dutch-lady-win-gold`](https://jomcontest.com/...) along with your name, NRIC, and contact number.

⏰ One entry per receipt. Receipts dated outside `01 Apr 2026 – 30 Jun 2026` are not eligible.
```

### `winners_comm_and_timeline_en` — good

```
📣 **Communication channels:** email + SMS to the contact details submitted with the entry.

| Milestone | Date | Channel |
| --- | --- | --- |
| Contest closes | 30 Jun 2026, 23:59 MYT | — |
| Drawing of winners | 15 Jul 2026 | Internal panel |
| Winners notified | by 31 Jul 2026 | 📧 Email + 📱 SMS |
| Prize delivery | within 60 days of confirmation | 🚚 Courier |

If a winner does not respond within **7 working days** of notification, the prize is forfeited and a reserve winner is drawn.
```

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
- No leftover `<!-- N chars max -->` comments — every one has been replaced
  with real content (or with the "Not specified" sentence).
- At least **one** of `prizes_*`, `eligible_products_*`, `eligible_stores_*`,
  `winners_comm_and_timeline_*` uses a markdown **table** when the T&C
  contains tabular data. (If the T&C is genuinely flat prose only, a table is
  not required.)
- Every `###` sub-heading is genuinely a sub-section (not a label that should
  have been part of a list).
- Emoji usage is minimal — at most one per sub-heading or one per bullet
  group; never on every line of prose.

If any check fails, fix the file before producing the download link.
