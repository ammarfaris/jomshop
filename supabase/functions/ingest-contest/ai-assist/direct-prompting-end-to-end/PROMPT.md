# Direct-prompting prompt (curl + submit, end-to-end)

This file **is** the prompt. Copy it from Admin → **Create Contest** → **Copy
AI Prompt → From URL** — or copy everything inside the `=== BEGIN PROMPT ===`
/ `=== END PROMPT ===` fence below into your AI chatbox, replace the single
`<CAMPAIGN_URL>` placeholder, and send. The AI will curl the page, extract the
TnC, build `contest.json`, and POST it as a **draft** to the JomContest Edge
Function — landing it in the Admin panel for a human to approve.

**For a first test**, append this single line to your message so the AI skips
the submit step and just shows you the JSON:

```
DRY RUN: skip the SUBMIT step and just show me contest.json.
```

> **Admin UI copy:** the fenced prompt below is also exported to
> `packages/app/features/admin/contestCursorPrompt.ts` for the
> **Copy AI Prompt → From URL** button. After editing this file, run
> `yarn sync-ingest-prompts` from the repo root.

```text
=== BEGIN PROMPT ===
You are the contest-ingestion editor for JomContest.com, a Malaysian contest
catalogue app. I will give you the URL of ONE Malaysian contest's public
campaign page. Your job: fetch the page and its TnC with curl, read the TnC,
turn it into a single JSON payload, and POST that payload to our ingest API
so it lands as a DRAFT in our admin panel. Do NOT produce any Markdown
document or downloadable file — contest.json is the only artifact.

INPUT URL: <CAMPAIGN_URL>

SCOPE — what's in and out:
- IN: any plain-HTML campaign page, brand .com.my site, WordPress promo
  microsite, or PDF TnC that curl can fetch without authentication.
- OUT: Facebook / Instagram / TikTok / X posts (login-gated), Cloudflare
  "verify you are human" walls, and sites whose HTML body is empty after
  JavaScript render. If <CAMPAIGN_URL> is any of those, STOP and tell me
  in one sentence — do NOT switch to a browser, do NOT improvise.

LENIENCY — never block a draft on a recoverable failure:
- Image fetch fails (404, 403, timeout, wrong Content-Type, `file` reports
  HTML instead of an image, image under 1000px): DELETE that image from
  ./images/ and OMIT the `images` array in contest.json. Note the gap in
  the final report. Do NOT retry more than once. A draft with no images is
  perfectly submittable — the admin can add images in the panel.
- TnC fetch fails (404, 403, timeout): if you already have enough info from
  landing.html to fill the required fields, build the JSON with what you
  have and append "Not specified in T&C" on the gaps. If you don't, note
  the failure and STOP — don't invent fields.
- Anti-bot wall or empty body on the campaign URL: STOP, note, don't retry.
- 422 from the API: the response lists every bad field; fix EXACTLY those,
  re-run step 7, re-submit ONCE. Do not change anything else.
- 500 mentioning an image: remove that image, re-submit ONCE.
- 500 mentioning something else, or 401: report verbatim and STOP.
NEVER retry more than once on the same error. NEVER loop on the same URL.

TOOLS YOU MAY USE — shell only:
- curl (HTML, PDFs, images) with a desktop User-Agent header
- pdftotext -layout <pdf> <txt>   (install once: brew install poppler)
- grep / rg / jq / python3 for parsing HTML and text
- node for the length-check script in step 7

STEPS — do these in order, narrating each command and its result briefly:

1. SET UP THE RUN FOLDER AND FETCH THE LANDING PAGE.
   Every run gets its own dated folder so re-runs and back-to-back contests
   don't overwrite each other. Layout:
     ~/JomContest/runs/<YYYY-MM-DD>-<slug>/
       ├── landing.html          ← curl of the campaign page
       ├── tnc-official.pdf      ← TnC PDF (when the TnC is a PDF)
       ├── tnc-official.txt      ← pdftotext extraction (when the TnC is a PDF)
       ├── contest.json          ← the final payload (the only thing submitted)
       └── images/
           └── 01-banner.jpg     ← downloaded key visual for audit
   a. RUNS="$HOME/JomContest/runs"; mkdir -p "$RUNS"; TODAY=$(date +%Y-%m-%d)
   b. Fetch into a temp dir first — we need the page <title> to name the
      folder. Use a desktop User-Agent for all curl calls in this run:
        UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
        TMP=$(mktemp -d)
        curl -sL -A "$UA" "<CAMPAIGN_URL>" -o "$TMP/landing.html"
   c. ANTI-BOT CHECK: if "$TMP/landing.html" is empty, or contains any of
      "Just a moment", "cf-challenge", "enable JavaScript", run
      `rm -rf "$TMP"` and STOP — this page is out of scope (see SCOPE).
   d. DERIVE <slug>: read <title> (and og:site_name if present) from
      landing.html and combine with the URL host. Pick host brand +
      campaign in kebab-case, ASCII-only, lowercase, [a-z0-9-] only
      (strip accents: Nestlé → nestle, ! → -, etc.). Examples:
        ntpmcontest2026.mypromotions.my + "Peraduan Jom Cuti-Cuti Malaysia"
          → ntpm-jom-cuti-cuti-malaysia
        giant.com.my/campaigns/nestle + "Supermarket Sweep Bersama Nestlé"
          → giant-supermarket-sweep-nestle
   e. RUN_DIR="$RUNS/$TODAY-<slug>". If it already exists, append -2, -3,
      … until free (so re-runs on the same day don't overwrite).
   f. mkdir -p "$RUN_DIR/images" && mv "$TMP/landing.html" "$RUN_DIR/" \
        && rmdir "$TMP" 2>/dev/null
   g. cd "$RUN_DIR". Every subsequent step runs from here. All file paths
      below are relative to $RUN_DIR.

2. FIND THE TnC LINK, ENTRY CHANNELS, AND KEY IMAGES in ./landing.html.
   - TnC link: search landing.html for <a href> whose anchor text or filename
     contains any of (case-insensitive) "Terma", "Syarat", "Terms",
     "Condition", "T&C", "tnc". The footer "Terma dan Syarat" link is the
     common case. Resolve any relative path against <CAMPAIGN_URL>.
   - Images: collect every <img src> in landing.html. Keep the largest one
     and/or anything named *banner* / *poster*. REJECT anything named like a
     template asset (left-img, right-img, placeholder, bg-pattern, logo) and
     anything whose Content-Type or byte size looks like an icon (HEAD it
     with `curl -sI <url>` first). Promo microsites often reuse stale images
     from OTHER brands' campaigns — when in doubt, view it before keeping it.
     Download each KEPT image into ./images/ with a 01-, 02-, … prefix
     (01-banner.jpg for the key visual). Rejected candidates: do not save.
   - Entry channels: capture every concrete way to participate shown on the
     landing page (current page form, CTA links/buttons, explicit "join now"
     URLs, QR destination URL if provided as text/link, WhatsApp numbers).
     Keep these for `translations.*.entry_method` together with TnC steps.

3. FETCH THE TnC AND EXTRACT ITS TEXT.
   - PDF TnC (URL-encode spaces and the & character — e.g. "T&C - X.pdf"
     becomes "T%26C%20-%20X.pdf"):
       curl -sL -A "$UA" "<encoded-tnc-url>" -o tnc-official.pdf
       pdftotext -layout tnc-official.pdf tnc-official.txt
   - HTML TnC page: strip tags to plain text. WordPress sites often expose
     clean content at /wp-json/wp/v2/pages?slug=<page-slug> — try that
     before falling back to tag-stripping.
   - Read ./tnc-official.txt in FULL before building anything.

4. BUILD contest.json — strict JSON (no comments, no trailing commas). Omit
   any optional key you have no data for. Schema:

   contest.title              official contest name. REQUIRED. ≤100 chars.
   contest.title_ms           Bahasa Malaysia title, only if it differs. ≤100.
   contest.summary            English summary. REQUIRED. ≤200, see SUMMARY RULES.
   contest.summary_ms         Bahasa Malaysia summary. REQUIRED. ≤200.
   contest.start_date         ISO 8601 with +08:00 offset. REQUIRED.
   contest.end_date           ISO 8601 with +08:00 offset. REQUIRED, must be
                              after start_date. If the TnC only gives an end
                              date, use T23:59:59+08:00.
   contest.total_prizes_value_rm
                              Number. ONLY if the TnC STATES a total prize
                              value in those words. Otherwise OMIT entirely
                              (a sum you compute from the tiers is not
                              "stated" — never put it in).
   contest.slug               Optional kebab-case slug; auto-generated if
                              omitted.
   contest.links              Object. Include ONLY the keys you actually
                              found on the page: website, facebook, instagram,
                              tiktok, x, youtube, aff_shopee, aff_lazada,
                              aff_tiktok_shop.
                              `website` is ONLY for the organiser/brand's
                              official website domain. Do NOT put third-party
                              form hosts, short links, or marketplaces in
                              `website`; include those entry URLs inside
                              `translations.*.entry_method` instead.

   translations.en            REQUIRED object. Keys and max lengths:
     eligible_participants                ≤1500   REQUIRED
     eligible_participants_exclusion      ≤1000   optional
     eligible_products                    ≤2400   REQUIRED
     eligible_stores                      ≤2000   REQUIRED
     prizes                               ≤2000   REQUIRED (include the
                                                   prizes AND any per-
                                                   participant limit)
    entry_method                         ≤2000   REQUIRED (step-by-step; if
                                                  WhatsApp is used, include
                                                  clickable
                                                  `https://wa.me/<digits>`)
     winners_selection_method             ≤2000   REQUIRED
     winners_comm_and_timeline            ≤1500   REQUIRED
     winners_list_and_announcement        ≤1000   REQUIRED
     link_tnc                             ≤300    optional (URL of TnC)
   translations.ms            Same keys and limits, complete Bahasa Malaysia
                              versions. Always required.

   images                     Optional array, ≤10 items. Each item is either
                              { "url": "https://…" } or
                              { "url": "https://…", "isMain": true }.
                              Public URLs only; mark the key visual as isMain.

   Do NOT add any other keys (no host_ids, no category_ids — a human admin
   assigns those during review).

   CONTENT RULES
   - Every translations value is consumer-friendly Markdown TEXT: short
     paragraphs, **bold**, bullet lists, tables, and light emoji. NEVER put
     a section title/heading inside a value — the JSON key already is the
     title.
  - EMOJI: include a minor amount in translation fields (at least one emoji
    per locale across the translation object) as visual anchors (e.g. 🎁
    prizes, 📝 entry steps, 🛒 products, 🏪 stores, 🏆 winners). At most one
    emoji per bullet or paragraph lead; never decorate every line. No emoji
    in summary, summary_ms, or titles. Skip emoji in dense or legal-heavy
    fields.
  - ENTRY METHOD RECONCILIATION: combine participation channels from both
    TnC and landing page evidence. If the landing page itself is an entry
    form/URL (often QR destination) and TnC also gives WhatsApp/other
    instructions, include BOTH options clearly in `entry_method` (e.g.
    Option 1/Option 2) for both locales.
  - WHATSAPP LINKS: whenever `entry_method` includes WhatsApp, render the
    number as a clickable Markdown link using `https://wa.me/<digits>`
    (digits only, include country code, no spaces or symbols).
  - LINK FORMAT (for Markdown translation fields): every URL shown in
    `translations.*` must be clickable Markdown with a HARD threshold:
    if URL length is ≤70 characters, show the full URL as link text
    (`[https://example.com/path](https://example.com/path)`); if URL length
    is >70 characters, use a concise descriptive link label
    (`[Official entry form](https://very-long-url...)`). Apply this to all
    external links in translation fields. Keep `contest.links.*` and
    `translations.*.link_tnc` as raw URL strings (not Markdown).
   - Extract strictly; do not invent. If the TnC lacks info for a required
     field, write what is known and append "Not specified in T&C".
   - Both languages always: if the TnC is English-only, translate into
     Bahasa Malaysia (NOT Bahasa Indonesia); if Malay-only, translate into
     English.
   - Hard-respect every max length. If you have to trim, drop minor details
     — NEVER drop or shorten the prizes or the entry steps.

   SUMMARY RULES (summary and summary_ms)
   - Hard limit 200 chars each; aim for 180–200.
   - Focus on the prizes and how to win; add the contest dates if space
     allows.
   - EXCLUDE eligibility info (e.g. "open to Malaysians only").

5. SANITY-CHECK IMAGES. Run `file ./images/<name>` on each kept image. A
   real JPEG/PNG at ≥1000px on one side passes; anything else fails the
   check. Apply the LENIENCY rule above (delete + omit + note, retry at
   most once with a different candidate).

6. SAVE the JSON to ./contest.json (in $RUN_DIR, where you are now).

7. VALIDATE LOCALLY — run this exact script and confirm it prints "OK"
   before submitting. If it prints FAIL, fix every listed field and re-run
   until OK:

   node -e '
   const j = JSON.parse(require("fs").readFileSync("contest.json","utf8"));
   const L = {prizes:2000,link_tnc:300,eligible_products:2400,eligible_participants:1500,eligible_participants_exclusion:1000,eligible_stores:2000,winners_selection_method:2000,entry_method:2000,winners_list_and_announcement:1000,winners_comm_and_timeline:1500};
   const C = {title:100,title_ms:100,summary:200,summary_ms:200,slug:200};
   const K = {website:400,facebook:400,instagram:400,tiktok:200,x:200,youtube:200,linkedin:400,aff_shopee:1000,aff_lazada:1000,aff_tiktok_shop:1000,link_media_website:400,link_media_facebook:400,link_media_instagram:400,link_media_tiktok:200,link_media_x:200,link_media_youtube:200,link_media_linkedin:400,link_aff_shopee:1000,link_aff_lazada:1000,link_aff_tiktok_shop:1000};
   const reqEn = ["prizes","eligible_products","eligible_participants","eligible_stores","winners_selection_method","entry_method","winners_list_and_announcement","winners_comm_and_timeline"];
   const e = [];
   for (const k of ["title","summary","start_date","end_date"])
     if (!String(j.contest?.[k] ?? "").trim()) e.push(`contest.${k} is required`);
   for (const [k,m] of Object.entries(C))
     if ((j.contest?.[k]||"").length > m) e.push(`contest.${k}=${(j.contest[k]||"").length}>${m}`);
   const links = {...(j.contest||{}), ...(j.contest?.links||{})};
   for (const [k,m] of Object.entries(K)) {
     const v = links?.[k];
     if (typeof v === "string" && v.length > m) e.push(`contest.links.${k}=${v.length}>${m}`);
   }
   for (const f of reqEn)
     if (!String(j.translations?.en?.[f] ?? "").trim()) e.push(`translations.en.${f} is required`);
   for (const loc of ["en","ms"]) for (const [f,m] of Object.entries(L))
     if (j.translations?.[loc]?.[f] && j.translations[loc][f].length > m)
       e.push(`translations.${loc}.${f}=${j.translations[loc][f].length}>${m}`);
   console.log(e.length ? "FAIL:\n" + e.join("\n") : "OK");
   '

8. SUBMIT — UNLESS this is a DRY RUN. Run exactly:
   set -a; [ -f ~/JomContest/.env ] && . ~/JomContest/.env; set +a
   curl -s -X POST "https://abdaylmwkcmxmsvagfch.supabase.co/functions/v1/ingest-contest" \
     -H "content-type: application/json" \
     -H "x-ingest-key: $INGEST_CONTEST_KEY" \
     --data-binary @contest.json

   Interpret the response per the LENIENCY block above. Summary:
   - 201 with { success: true, slug, reviewUrl } → SUCCESS. Report the slug
     and the reviewUrl. The contest is now a DRAFT (visibility='admin') in
     the Admin panel. A human must open reviewUrl and approve before it
     goes live. Do NOT attempt to publish.
   - 422 → fix EXACTLY the listed fields, re-run step 7, re-submit ONCE.
   - 500 mentioning an image → remove that image, re-submit ONCE.
   - 500 mentioning something else, or 401 → report verbatim and STOP.

FINAL REPORT — after submit (or in DRY RUN, after step 7), give me:
   - **the run folder path** ($RUN_DIR) — everything from this run lives
     there for audit and re-runs,
   - the contest title (EN + MS) and date range you extracted,
   - the TnC source URL,
   - the images kept (filenames + dimensions) and any rejected,
   - the validation result ("OK" or the fixed fields),
   - the HTTP status, slug, and reviewUrl from the submit (or "DRY RUN"),
   - any gaps: fields where the TnC was silent, links you couldn't find,
     images you couldn't fetch.

Then STOP. Do not loop, do not retry on success, do not attempt to publish.
=== END PROMPT ===
```

---

## Appendix — human-facing notes (do NOT paste into the chatbot)

Everything below this line is reference material for the human operator. The
AI never needs to see it; the prompt above is self-contained.

### Wait — will this work in Gemini / ChatGPT web?

**No.** This prompt needs a shell. The 8 steps use `curl`, `pdftotext`,
`grep`, and `node`, plus a local `~/JomContest/.env` file for the ingest key
— none of which exist in `gemini.google.com/app` or `chatgpt.com`. Hosted
chatbots (Gemini, ChatGPT, Claude.ai web) can:

- fetch a URL through their search integration, but only a **summary**, not
  the raw HTML — useless for finding a "Terma dan Syarat" PDF link in a
  footer;
- read a PDF you **upload** natively (so `pdftotext` isn't needed);
- build the JSON well;
- **NOT** POST to your Edge Function (no shell, no `INGEST_CONTEST_KEY` on
  your machine — and you should never paste the key into a third-party
  chatbot anyway).

For hosted chatbots, use the **Prompt B** flow instead:

1. JomContest Admin → **Create Contest** → **Copy AI Prompt → From T&C**
   (source of truth: `packages/app/features/admin/contestJsonPrompt.ts`).
2. Paste that prompt into Gemini/ChatGPT **along with the TnC** — either
   paste the text or upload the PDF (no `pdftotext` needed; they read PDFs
   natively).
3. Copy the chatbot's `json` code block.
4. Bring it back one of two ways:
   - **Admin UI** → Create Contest → **Paste JSON** / **Import (.json)** —
     no key, no shell, fully human review. Easiest.
   - **Shell on your machine** → save as `contest.json`, run the curl POST
     from step 8 of the prompt above (this is "Prompt A½" in
     [`../autoclaw-needs-tuning/PROMPT.md`](../autoclaw-needs-tuning/PROMPT.md)).

The folder split mirrors the runtime split: this folder is end-to-end on
shell-equipped AIs (Cursor, Claude Code, OpenClaw, AutoClaw); the
[`../autoclaw-needs-tuning/`](../autoclaw-needs-tuning/) folder covers the
Gemini/ChatGPT-web + human-submits path.

### When this prompt works, and when it doesn't

| ✅ Works (paste the URL and go) | ❌ Will refuse — use [`../autoclaw-needs-tuning/`](../autoclaw-needs-tuning/) instead |
| --- | --- |
| Direct campaign microsites (mypromotions.my, giant.com.my, brand.com.my/campaigns, WordPress landing pages) | Facebook / Instagram / TikTok / X posts — login-gated + bot-checked |
| Host brands' own `.com.my` TnC pages | Aggregator pages (*Kaki Peraduan…*) that point at FB posts |
| PDF TnCs hosted on the brand's domain or its promo platform | Anything behind a Cloudflare "verify you're human" wall |
| Plain-HTML prize / contest pages | Sites that JS-render all content (curl gets an empty shell) |

The prompt is hard-coded to STOP when it hits one of the ❌ cases. That's
deliberate — the browser-assisted AutoClaw flow is the right tool there, and
a confused half-result from curl is worse than a clean "this URL is out of
scope, use the other prompt".

### One-time key setup

The submit step sources `~/JomContest/.env`, which must contain exactly one
line:

```
INGEST_CONTEST_KEY=<the secret set in Supabase Edge Function secrets>
```

Create it once:

```bash
mkdir -p ~/JomContest
echo 'INGEST_CONTEST_KEY=<your key>' >> ~/JomContest/.env
```

**Rotate** any time — generate a new key, set it as the function secret, and
overwrite the local file. The curl snippet reads the file at submit time, so
rotation takes effect on the next run with nothing to restart:

```bash
openssl rand -hex 32                                         # 1. new key
supabase secrets set INGEST_CONTEST_KEY="<new-key>"          # 2. set in Supabase
echo 'INGEST_CONTEST_KEY=<new-key>' > ~/JomContest/.env      # 3. update local
```

Only the SUBMIT step needs the key. Dry runs and the browser-chatbot path
never see it.

### Run folder layout and lifecycle

Each run of this prompt writes everything to one dated folder:

```
~/JomContest/runs/
├── 2026-07-13-ntpm-jom-cuti-cuti-malaysia/
│   ├── landing.html
│   ├── tnc-official.pdf
│   ├── tnc-official.txt
│   ├── contest.json
│   └── images/01-banner.jpg
├── 2026-07-14-giant-supermarket-sweep-nestle/
└── 2026-07-14-ntpm-jom-cuti-cuti-malaysia-2/    ← same-day re-run gets -2
```

This mirrors the `~/JomContest/inbox/<slug>/` convention the AutoClaw scout
flow uses (see [`../autoclaw-needs-tuning/SCOUT.md`](../autoclaw-needs-tuning/SCOUT.md))
— same brand of folder, same artifacts, just produced by curl instead of a
browser. Differences:

| | this curl flow | AutoClaw scout |
| --- | --- | --- |
| Folder root | `~/JomContest/runs/` | `~/JomContest/inbox/` |
| Folder name | `<YYYY-MM-DD>-<slug>` (date-prefixed, never collides) | `<slug>` (date lives inside `lead.md`) |
| Also writes | `contest.json` (built + submitted inline) | `contest.json` + `tnc-official.md` + `lead.md` (review package; submission is a separate step) |

**Lifecycle:**

- After a contest is approved in `/admin` and live, the run folder can be
  moved to `~/JomContest/archive/` (matching the scout convention). The AI
  doesn't do this automatically — it's a one-line `mv` for the human.
- Re-runs on the same day get `-2`, `-3`, … suffixes (the prompt handles
  this in step 1e). Earlier folders are never overwritten, so you can diff
  two runs of the same contest.
- If a contest is rejected during admin review, the run folder is the audit
  trail — `landing.html` + `tnc-official.pdf` prove what the AI saw.

### Safety invariant (read once)

Every ingest path — this curl flow, the AutoClaw pipeline, even a human
admin's JWT — lands the contest with `visibility = 'admin'`. The Edge
Function hard-codes this in [`../../index.ts`](../../index.ts); **no AI or
curl call can publish a contest**. Three independent guards:

1. The Edge Function ignores any visibility the AI sends and forces
   `'admin'`.
2. The submit endpoint only accepts the shared secret (`x-ingest-key`) or a
   human admin's JWT — the AI never holds an admin session.
3. Flipping visibility to `users`/`any` is a separate write that requires an
   admin JWT — there is no AI path to it.

Treat the AI as a draft factory. The human always clicks publish.

### Trial run — NTPM Jom Cuti-Cuti Malaysia (validated 2026-07-13)

The [`trial/`](./trial/) folder is a complete worked run of this prompt
against `https://ntpmcontest2026.mypromotions.my/`. It contains:

| File | What it is |
| --- | --- |
| `landing.html` | curl of the landing page |
| `tnc-official.pdf` | the 23-page "Terma dan Syarat" PDF (575 KB) |
| `tnc-official.txt` | `pdftotext -layout` extraction |
| `images/01-banner.jpg` | the 2560×1200 campaign banner (538 KB) |
| `contest.json` | the uploadable payload, 0 errors / 0 over-limit |
| `README.md` | step-by-step, with the actual curl commands and findings |

The `trial/` folder itself is a snapshot of what `$RUN_DIR` looks like after
a successful run — same files, same layout. On a real run the AI writes them
to `~/JomContest/runs/2026-07-13-ntpm-jom-cuti-cuti-malaysia/` instead.

Reproduce it by pasting the prompt above into a shell-equipped chatbot with
`<CAMPAIGN_URL> = https://ntpmcontest2026.mypromotions.my/`. The expected
result matches `trial/contest.json` and lands as a draft at the returned
`reviewUrl`.
