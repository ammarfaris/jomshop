# Batch prompt (multi-URL queue, one Cursor turn)

For when you have **several contest URLs** to ingest. The single-contest
[`PROMPT.md`](./PROMPT.md) is the canonical source for the schema, content
rules, and submit behavior — this prompt wraps it for a queue.

**Why this exists:** Cursor's old pricing plan is request-capped (500/period),
not usage-based. Running `PROMPT.md` once per URL costs ~3–6 requests per
contest (curl + read + build + validate + submit + report). This batch prompt
processes the whole queue in **one** chat turn, with continue-on-error, so
10 contests cost roughly 1 request instead of 30–60.

**When to use which:**

| | `PROMPT.md` (single) | `BATCH.md` (this file) |
| --- | --- | --- |
| URLs | 1 | 2–20+ |
| Cursor requests | ~3–6 per URL | ~1 for the whole batch |
| Best for | one tricky contest, debugging, first run | clearing a backlog |
| Risk | low (full attention on one) | later items get less attention; harder to course-correct mid-batch |

For your first batch, start with **3 URLs** to confirm the loop works, then
scale up.

## How to use

1. Make sure `~/JomContest/.env` contains `INGEST_CONTEST_KEY=<your key>`
   (same as the single-contest flow — see
   [`PROMPT.md` appendix](./PROMPT.md#one-time-key-setup)).
2. Copy everything inside `=== BEGIN PROMPT ===` / `=== END PROMPT ===` below.
3. Replace the `<URL_1>`, `<URL_2>`, … lines with your actual URLs. Add or
   remove lines freely — the AI reads the list, doesn't count them.
4. **For a first test**, append `DRY RUN: skip every SUBMIT step and just
   show me the per-URL contest.json files.` so you can verify the loop
   without posting anything.

```text
=== BEGIN PROMPT ===
You are the contest-ingestion editor for JomContest.com, running in BATCH
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
- Image fetch fails for URL N → omit `images` from that URL's contest.json,
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
  ✓ submitted (slug=<slug>, reviewUrl=<url>)
  ✓ submitted, no images (image fetch failed — see run folder)
  ✗ skipped: <one-line reason> (run folder: <path>)
  ✗ submit failed: <HTTP status + one-line reason>
Keep these lines short — the goal is a scannable summary at the end.

FINAL SUMMARY — after the last URL, print a table:
  Total: <N> URLs processed
  ✓ submitted: <count>  (of which <count> missing images)
  ✗ skipped/failed: <count>
  Run folders: ~/JomContest/runs/<date>-*
Then list the failed ones with one-line reasons, so I can decide whether to
re-run them with the single-contest prompt (which gives them full attention).

Then STOP. Do not loop, do not retry the batch, do not attempt to publish
any contest.
=== END PROMPT ===
```

## Appendix — human-facing notes

### Cost model

On Cursor's old request-capped plan, every chat turn is one request regardless
of how much work happens inside it. So:

- **Single prompt × 10 contests** = 10 separate chats × ~3–6 turns each
  (you paste, AI curls, AI builds, AI submits, AI reports, you might correct
  once) = **30–60 requests** for 10 contests.
- **Batch prompt × 10 contests** = 1 chat × 1 turn (the AI does all 10 in
  that one turn) = **~1 request** for 10 contests. The catch: that one turn
  takes longer and burns more tokens-per-turn, but tokens aren't the
  bottleneck on your plan — requests are.

The tradeoff is attention: the single-contest prompt gives each URL the AI's
full focus, while the batch prompt makes the AI context-switch between
contests. For simple, similar contests (same promo platform, same TnC shape)
batch is fine. For weird or high-stakes ones, run them singly.

### Failure handling — what to do with the ✗ list

The final summary tells you which URLs failed. Three recovery paths:

1. **Anti-bot wall / JS-rendered shell** → that URL is out of scope for this
   flow. Use [`../autoclaw-needs-tuning/`](../autoclaw-needs-tuning/) instead
   (browser-assisted).
2. **422 / 500 on submit** → re-run that one URL with the single-contest
   [`PROMPT.md`](./PROMPT.md). The run folder already has the source files;
   you can tell the AI "use the existing run folder at <path> and re-submit"
   instead of re-fetching.
3. **Image fetch failed but submit succeeded** → the draft is already in the
   Admin panel; just open the `reviewUrl` and add images via the gallery
   picker. No re-run needed.

### When NOT to use batch

- **First time running this flow** — use `PROMPT.md` once on the NTPM trial
  URL to confirm your setup works, then switch to batch for the rest.
- **One contest that's behaving weirdly** — drop out of batch, run it
  singly, debug, then resume batch for the others.
- **More than ~20 URLs in one batch** — the AI's attention drops on later
  items. Split into batches of 10–15.

### Trial run

There's no separate batch trial folder — the single-contest
[`trial/`](./trial/) is the reference for what each per-URL pipeline should
produce. A batch run produces N sibling folders under `~/JomContest/runs/`,
each shaped like `trial/`.
