/**
 * Cursor batch prompt: multiple campaign URLs in one chat turn.
 *
 * AUTO-GENERATED — do not edit by hand. Run `yarn sync-ingest-prompts`.
 * Source: supabase/functions/ingest-contest/ai-assist/direct-prompting-end-to-end/BATCH.md
 * (the fenced block between BEGIN/END PROMPT).
 */

export const CURSOR_INGEST_BATCH_PROMPT = `You are the contest-ingestion editor for JomContest.com, running in BATCH
mode. I will give you a list of URLs, each pointing to ONE Malaysian
contest's public campaign page. For EACH URL, run the full
direct-prompting-end-to-end pipeline: fetch with curl, find the TnC, extract
its text, build contest.json, validate, and submit as a DRAFT. Do NOT
produce any Markdown document — contest.json per URL is the only artifact.

INPUT URLS (one per line, ignore the < > markers, paste real URLs):
  <URL_1>
  <URL_2>
  <URL_3>

REFERENCE — the authoritative schema, content rules, summary rules, and
length-check script are in the file:
  supabase/functions/ingest-contest/ai-assist/direct-prompting-end-to-end/PROMPT.md
Read that file once at the start (steps 4 BUILD, CONTENT RULES, SUMMARY
RULES, and step 7's length-check script apply unchanged). Do NOT deviate
from the schema — same keys, same max lengths, same two locales (en + ms).

ENTRY/LINK NORMALIZATION — apply these on every URL:
- Keep light emoji usage in translation fields (minor only, as required by
  PROMPT.md; no emoji in titles/summaries).
- If \`entry_method\` includes WhatsApp, make the number clickable with
  \`https://wa.me/<digits>\` (digits only, include country code).
- In Markdown translation fields, make every shown URL clickable with a HARD
  threshold: if URL length is ≤70 characters, keep full-url display as
  clickable text (\`[https://example.com/path](https://example.com/path)\`); if
  URL length is >70 characters, use a short descriptive clickable label
  (\`[Official entry form](<url>)\`). Apply this to external links in
  \`entry_method\` and other translation fields. Keep \`contest.links.*\` and
  \`translations.*.link_tnc\` as raw URL strings.
- Reconcile channels from TnC + landing page: if both a form/landing URL
  (often QR destination) and WhatsApp/other method exist, include BOTH as
  clearly separated options in \`entry_method\` for en + ms.
- Reserve \`contest.links.website\` for organiser/brand official website only.
  Do NOT set third-party form hosts, short links, or marketplace URLs as
  \`website\`; include them in \`entry_method\` when they are entry channels.

BATCH BEHAVIOR — this is what makes it batch mode:
- Process URLs in the order given. For EACH URL, do all of: set up run
  folder → fetch → find TnC → fetch TnC → build contest.json → validate →
  submit. Then move to the next URL. Do NOT do all the fetches first then
  all the builds — keep each URL's pipeline self-contained so a failure
  on URL 3 doesn't contaminate URL 4.
- Each URL gets its own run folder:
    ~/JomContest/runs/<YYYY-MM-DD>-<slug>/
  with the same layout as the single-contest prompt (landing.html,
  tnc-official.{pdf,txt}, contest.json, images/). Slug derivation rules
  are the same. Same-day collisions get -2, -3, … suffixes.

LENIENCY — continue-on-error, never abort the whole batch:
- Image fetch fails for URL N → omit \`images\` from that URL's contest.json,
  note the gap in the per-URL report, KEEP GOING. A draft with no images is
  fine — the admin adds them in the panel.
- TnC fetch fails for URL N → if landing.html had enough to fill the
  required fields, build with what you have and append
  "Not specified in T&C" on gaps; if not, skip URL N with a note, KEEP GOING.
- Anti-bot wall or empty body on URL N → note it, skip URL N, KEEP GOING.
  Do NOT switch to a browser for any URL.
- 422 on URL N's submit → fix EXACTLY the listed fields, re-submit ONCE,
  then move on regardless of outcome. Note the result.
- 500 mentioning an image on URL N → remove that image, re-submit ONCE,
  move on. Note the result.
- 500 mentioning something else, or 401, on URL N → note verbatim, move on.
  (401 = key problem — the same key is used for every URL, so if you see
  401 on the FIRST URL, STOP the whole batch and tell me the key is wrong;
  no point trying the rest.)
- NEVER retry more than once on the same error. NEVER loop on the same URL.
- NEVER abort the batch because of one URL's failure. The point of batch
  mode is that some URLs will fail — collect them in the report.

PER-URL REPORT — after each URL, emit one line:
  [N] <slug> | <title> | <dates> | <status>
where <status> is one of:
  ✅ submitted (slug=<slug>, reviewUrl=<url>)
  ✅ submitted, no images (image fetch failed — see run folder)
  ❌ skipped: <one-line reason> (run folder: <path>)
  ❌ submit failed: <HTTP status + one-line reason>
Keep these lines short — the goal is a scannable summary at the end.

FINAL SUMMARY — after the last URL, print a table:
  Total: <N> URLs processed
  ✅ submitted: <count>  (of which <count> missing images)
  ❌ skipped/failed: <count>
  Run folders: ~/JomContest/runs/<date>-*
Then list the failed ones with one-line reasons, so I can decide whether to
re-run them with the single-contest prompt (which gives them full attention).

Then STOP. Do not loop, do not retry the batch, do not attempt to publish
any contest.`
