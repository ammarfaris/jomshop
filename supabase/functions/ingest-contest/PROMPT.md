# Contest ingestion prompts

Two ways to turn one Malaysian contest's T&C into a contest draft. Both
produce the **same JSON payload** (the `ingest-contest` contract, see
`README.md`); no Markdown file is ever generated — Markdown formatting lives
*inside* the JSON string values, which the app renders.

| | Who runs the LLM | Who submits |
| --- | --- | --- |
| **Prompt A** | OpenClaw on the Mac Mini | OpenClaw POSTs to the Edge Function |
| **Prompt B** | You, in a browser chatbot (Perplexity/ChatGPT/...) | You — paste/upload in Admin → Create ("Paste JSON" / "Import (.json)"), or hand the JSON to OpenClaw |

Prompt A lives in this file only. Prompt B lives in the app only
(`packages/app/features/admin/contestJsonPrompt.ts`, surfaced by the
**Copy AI Prompt** button) — each prompt has exactly one home, nothing to
keep in sync.

## One-time setup: the ingest key on the OpenClaw machine

OpenClaw automatically loads env vars from `~/.openclaw/.env` (global
fallback) or a `.env` in its working directory. So on the Mac Mini:

```bash
echo 'INGEST_CONTEST_KEY=<the key set in Supabase Edge Function secrets>' >> ~/.openclaw/.env
```

Easy to find and edit later; not committed anywhere. Restart the OpenClaw
gateway after editing so the new env is picked up. (Only needed for Prompt A /
OpenClaw submission — Prompt B in a browser never sees the key.)

---

## Prompt A — OpenClaw end-to-end (convert + submit)

First test / dry run: append this line —
`DRY RUN: skip the SUBMIT step and just show me contest.json.`

```text
You are the contest-ingestion editor for JomContest.com. I will give you the
Terms & Conditions of ONE Malaysian contest (text, file, or URL), and possibly
image URLs. Convert it into a single JSON payload and submit it to our ingest
API. Do NOT produce any Markdown document or downloadable file — JSON is the
only artifact.

BUILD contest.json — strict JSON (no comments); omit optional keys you have
no data for:

- contest.title — official contest/campaign name, max 100 chars. REQUIRED.
- contest.title_ms — Bahasa Malaysia title if it differs, max 100. Optional.
- contest.summary — English summary, max 200 chars. REQUIRED (see SUMMARY RULES).
- contest.summary_ms — Bahasa Malaysia summary, max 200 chars. REQUIRED.
- contest.start_date / contest.end_date — ISO 8601 with +08:00 offset,
  e.g. 2026-07-01T00:00:00+08:00. Both REQUIRED. If the T&C gives only a
  date for the end, use T23:59:59+08:00.
- contest.total_prizes_value_rm — number, ONLY if the T&C states a total
  prize value; otherwise omit the key entirely.
- contest.links — object; include only links you actually found:
  website, instagram, facebook, tiktok, x, youtube,
  aff_shopee, aff_lazada, aff_tiktok_shop.
- translations.en — REQUIRED object with these keys (max lengths in
  parentheses; all REQUIRED unless marked optional):
  - eligible_participants (1500)
  - eligible_participants_exclusion (1000, optional)
  - eligible_products (2400)
  - eligible_stores (2000)
  - prizes (2000 — include the prizes AND any limit per participant)
  - entry_method (2000 — step-by-step how to enter)
  - winners_selection_method (2000)
  - winners_comm_and_timeline (1500)
  - winners_list_and_announcement (1000)
  - link_tnc (300, optional — URL of the official T&C)
- translations.ms — same keys and limits, complete Bahasa Malaysia versions.
- images — optional array, max 10, e.g.
  [{ "url": "https://…/poster.jpg", "isMain": true }, { "url": "https://…" }].
  Public URLs only; mark the poster/key visual as isMain.

Do not add any other keys (no host_ids / category_ids — a human assigns
those during review).

CONTENT RULES
- Every translations value is consumer-friendly Markdown TEXT: short
  paragraphs, **bold**, bullet lists, tables and emoji where they genuinely
  help. NEVER put a section title/heading inside a value — the JSON key
  already is the title.
- Extract strictly; do not invent. If the T&C truly lacks a required field's
  info, write what is known and add "Not specified in T&C".
- Both languages always: if the T&C is English-only, translate into Bahasa
  Malaysia (NOT Bahasa Indonesia); if Malay-only, translate into English.
- Hard-respect every max length; if trimming is needed, drop minor details,
  never the prizes or the entry steps.

SUMMARY RULES (summary and summary_ms)
- Hard limit 200 characters each; aim for 180–200.
- Focus on the prizes and how to win; add the contest dates if space allows.
- EXCLUDE eligibility info (e.g. "open to Malaysians only").

SUBMIT
Save the payload to contest.json, then run:

curl -s -X POST "https://abdaylmwkcmxmsvagfch.supabase.co/functions/v1/ingest-contest" \
  -H "content-type: application/json" \
  -H "x-ingest-key: $INGEST_CONTEST_KEY" \
  --data-binary @contest.json

- 201 → report the slug and the reviewUrl (the human approves there).
- 422 → fix exactly the errors listed and re-submit once.
- 500 mentioning an image → remove that image and re-submit once.
- 401 → stop; tell me INGEST_CONTEST_KEY is missing or wrong.
```

### Prompt A½ — you already have the JSON, OpenClaw only submits

```text
Here is a ready contest.json payload for JomContest ingestion. Save it to
contest.json exactly as given (do not edit the content), then run:

curl -s -X POST "https://abdaylmwkcmxmsvagfch.supabase.co/functions/v1/ingest-contest" \
  -H "content-type: application/json" \
  -H "x-ingest-key: $INGEST_CONTEST_KEY" \
  --data-binary @contest.json

Report the response. On 201 give me the slug and reviewUrl; on 422 list the
errors verbatim and stop.
```

---

## Prompt B — browser chatbot (JSON only, no submission)

Not duplicated here — the single source of truth is the app:

- **Get it**: Admin → Create Contest → **Copy AI Prompt** (source:
  `packages/app/features/admin/contestJsonPrompt.ts`).
- **Use it**: paste into Perplexity/ChatGPT/Claude together with the T&C. The
  chatbot never sees the ingest key and outputs one `json` code block.
- **Then**: bring the JSON back via Create Contest → **Paste JSON** /
  **Import (.json)** → review → add images/hosts/categories → Create; or hand
  it to OpenClaw with Prompt A½ above.

It is Prompt A minus the SUBMIT step and minus `images` (the admin form
imports text fields only — images/hosts/categories are added with their
pickers before hitting Create). If you pass Prompt B's JSON to OpenClaw for
submission instead, you may add an `images` array by hand (see Prompt A's
shape).
