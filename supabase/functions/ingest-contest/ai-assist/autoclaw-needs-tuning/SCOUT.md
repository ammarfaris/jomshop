# Contest Scout (Prompt S) — lead URL → review package

Scenario One of contest feeding: hand the Mac-Mini agent (OpenClaw, or
AutoClaw — Z.AI's packaged OpenClaw distribution) a contest lead, get back a
**review package**: the official T&C captured verbatim, the campaign images
saved at original resolution, and a ready `contest.json` built per Prompt A's
rules (`PROMPT.md`). Nothing is submitted; a human reviews and imports.

The lead URL can be any of:

- a Facebook post by an **aggregator** page (e.g. *Kaki Peraduan di
  Malaysia*) — the common case;
- the host brand's **own social post** (Facebook/Instagram/TikTok);
- the **official campaign / T&C page itself** (e.g.
  `giant.com.my/campaigns/nestle/`) — the easiest case: the scout skips
  discovery and only works backwards for the host's social permalinks.

```
lead URL ──▶ Prompt S (scout) ──▶ ~/JomContest/inbox/<slug>/ ──▶ human review
                                                                    │
                                    Admin → Create → Paste JSON ◀───┤
                                    (images via gallery picker)     │
                                    — or — Prompt A½ submit ◀───────┘
```

## Two run files: full vs lite (token budget decides)

Both live next to this file; each is the single home of its prompt —
fine-tune there, then re-ship to the Mini (command below).

| | [`scout-prompt.md`](./scout-prompt.md) — **full** | [`scout-lite-prompt.md`](./scout-lite-prompt.md) — **lite** |
| --- | --- | --- |
| You provide | just a lead URL | the URLs you already found (official post / site / T&C) |
| Agent does | discovery + fetch + builds `contest.json` | fetch & file only — shell-first, browser only for the FB post |
| Token cost | highest (browsing loop + JSON build) | minimal |
| `contest.json` built by | the Mini agent | you, afterwards: **Prompt B in a flat-rate chatbot** (Copy AI Prompt → attach `tnc-official.pdf` → Paste JSON) — or ask the agent to apply scout-prompt.md steps 5–9 to the package |

**While API tokens are tight, default to lite + Prompt B**: you spend ~3
minutes of clicking per contest and the Mini spends almost nothing — the
browsing loop with screenshots is what burns tokens, not the curl commands.

Tempting-but-skip: having the agent drive gemini.google.com / claude.ai in
its browser to build the JSON. Ferrying the T&C in and the JSON out through
browser snapshots costs agent tokens anyway, it's brittle, and automated use
of consumer chatbot UIs violates their terms — risking your *main* accounts,
not the dummy. The manual paste is faster in practice.

## One-time Mac Mini setup

```bash
mkdir -p ~/JomContest/inbox ~/JomContest/archive
touch ~/JomContest/leads.md
brew install zbar poppler   # zbarimg — QR decoding · pdftotext — T&C PDFs
```

Ship the prompts from the repo to the Mini — re-run after every fine-tune:

```bash
# from the repo root on your laptop
scp supabase/functions/ingest-contest/scout-prompt.md supabase/functions/ingest-contest/scout-lite-prompt.md \
   <user>@<mini>.local:~/JomContest/
```

- Log the agent's browser into the **dummy** Facebook account once, manually.
  The scout never interacts with anything (hard rules in the prompt); if the
  account gets blocked, just swap in a new one. (Logging the same dummy into
  Instagram too helps with IG leads.)
- The ingest key (`~/JomContest/.env`, see `PROMPT.md`) is only needed for
  the Prompt A½ submit path — scouting never touches it.

## The package convention

One folder per contest under `~/JomContest/inbox/`:

```
inbox/giant-supermarket-sweep-nestle/
  contest.json      # ingest payload (Prompt A shape, no images/host_ids) — validated by the admin import report
  tnc-official.md   # official T&C VERBATIM + source URL + capture date + poster fine print (source of truth)
  lead.md           # provenance: full link trail, host brands, image list, gaps for the reviewer
  images/
    01-poster.jpg   # key visual, original resolution → gallery "main"
    02-*.png        # anything else worth the gallery (max 10)
```

`~/JomContest/leads.md` is the queue — one URL per line:

```
- [ ] https://www.facebook.com/kakicontestMalaysia/posts/pfbid0AAA...
- [x] https://www.facebook.com/kakicontestMalaysia/posts/pfbid0BBB... → inbox/giant-supermarket-sweep-nestle (2026-07-11)
```

"Scout the next unchecked lead in ~/JomContest/leads.md" processes one and
checks it off with the package path; "scout all unchecked leads" batches the
whole queue, one package per contest — the practical bottleneck is your
review, not the scouting. After importing a package, move its folder to
`~/JomContest/archive/`.

## First test run, step by step

1. **Prep the Mini** — run the setup block above (folders, zbar, scp the
   prompt).
2. **Browser login check** — in whichever channel you chat with the agent
   (WhatsApp / Telegram / web UI), send:
   > Open https://www.facebook.com in your browser and screenshot what you
   > see.
   If the screenshot shows a login page, log the dummy account in manually
   in that browser window on the Mini's screen — the profile persists, so
   once is enough.
3. **Fire the run** (use your strongest configured model — this is a long
   multi-step task):
   > Read ~/JomContest/scout-prompt.md and follow it exactly.
   > Lead URL: https://www.facebook.com/kakicontestMalaysia/posts/pfbid02SY2raftnckvNi56q1PQk3BMYCXqRnpofKbVeqDTNaMU9PBRLLSm1DtojnjpCYEFzl

   That lead is the validated reference run (worked example below), so the
   output can be graded against a known-good answer. Expected behaviour, in
   order: open the post → save the poster images → `zbarimg` the QR →
   resolve `bit.ly/4bvtZu6` → land on `giant.com.my/campaigns/nestle/` →
   capture the T&C → write the package → report the package path and stop.
   Expect 5–15 minutes.

   Testing **lite** instead (cheapest — worked example 2 below):
   > Read ~/JomContest/scout-lite-prompt.md and follow it.
   > Campaign: Peraduan Jom Cuti-Cuti Malaysia (NTPM)
   > Official post: https://www.facebook.com/NtpmHoldingsBerhad/posts/pfbid034TYWbe1KjYMAbTCwdmybpiYZTTE419PTX1Zmv65fySudEhgtiocSSggHVBaF5Y5Bl
   > Official site: https://ntpmcontest2026.mypromotions.my/
4. **Verify on the Mini:**
   ```bash
   find ~/JomContest/inbox -type f
   cat ~/JomContest/inbox/giant-supermarket-sweep-nestle/lead.md
   open ~/JomContest/inbox/giant-supermarket-sweep-nestle/images/
   ```
   Pass checklist (compare with the worked example below):
   - `tnc-official.md` — all 10 T&C clauses verbatim, source =
     giant.com.my/campaigns/nestle/;
   - `contest.json` — same title, 4 Jun – 29 Jul 2026, RM38,000, EN + MS all
     filled;
   - `images/` — should *beat* the reference run (which was headless): the
     green social poster from the Facebook post, not just the cashier
     sticker from giant.com.my;
   - `lead.md` — closes the reference run's gap: the permalink of Giant
     Malaysia's own FB post;
   - nothing was liked, commented, followed, or submitted anywhere.
5. **Feed the app** — follow "Reviewing and importing" below. Doing it on
   the Mini itself is simplest: `cat …/contest.json | pbcopy`, then Admin →
   Create Contest in a normal browser.
6. **If something misbehaves:**
   - login wall on the post → step 2 wasn't done in the browser the agent
     actually controls; redo and rerun;
   - `zbarimg: command not found` → `brew install zbar` (for the Giant lead
     it doesn't matter — the bit.ly route reaches the same page);
   - it prints JSON in chat instead of writing files → reply "write the
     package files to ~/JomContest/inbox/<slug>/ exactly as the run file
     specifies";
   - it wanders or stalls → usually model strength; switch to your best
     model and rerun.

## Reviewing and importing a package (the human, ~2 min)

1. Read `lead.md` (gaps first); spot-check `contest.json` against
   `tnc-official.md`.
2. Admin → Create Contest → **Paste JSON** (or **Import (.json)**) — the
   import report flags anything missing or over limit.
3. Add `images/` via the gallery picker (01-poster as main), pick hosts and
   categories, review, **Create**.
4. Move the folder to `~/JomContest/archive/` and tick it off in `leads.md`.

Alternative (skip the form): hand `contest.json` to the agent with Prompt A½
(`PROMPT.md`). On that path you may add the saved images as base64 data-URIs —
the Edge Function accepts `{ "base64": "data:image/jpeg;base64,…",
"contentType": "image/jpeg" }`, ≤10 images, ≤15 MB each; never send fbcdn
URLs. The contest lands as `visibility = 'admin'` with a `reviewUrl`.
**For the first ~50 contests prefer the form path** — it forces eyes on every
field while the catalogue's quality bar is being set.

## Worked example — validated 2026-07-11 (Giant Supermarket Sweep Bersama Nestlé)

Trail the scout is expected to reproduce, from the real dry run:

| Step | Result |
| --- | --- |
| Lead | facebook.com/kakicontestMalaysia post (9 Jul 2026) |
| Hosts identified | Giant Malaysia (GCH Retail (M) Sdn Bhd) × Nestlé Malaysia |
| Host's own FB post | "Terma & syarat: https://bit.ly/4bvtZu6" |
| Shortener resolved | bit.ly/4bvtZu6 → https://www.giant.com.my/campaigns/nestle/ |
| Poster QR | points to the same campaign page ("Imbas & Daftar") |
| T&C captured | WordPress REST: giant.com.my/wp-json/wp/v2/pages/15589 |
| Images | poster 1781×2518 + receipt sample, straight off giant.com.my |
| Poster-only facts | prize breakdown (20×RM1,000 sweep, 80×RM200 voucher), excluded products (Starbucks, NESPRESSO, infant formula 1&2, NUTREN, PURINA), RM1,000 cap |
| contest.json | 28 fields, EN+MS complete — admin importer: 0 errors / 0 missing / 0 over-limit |

Field-tone excerpt (note the attribution when a fact comes from the poster,
not the T&C page):

```json
"prizes": "🏆 **Grand Prize — 20 winners:** a **Supermarket Sweep**: a free 3-minute trolley dash worth up to **RM1,000** (5 winners per region — Central, Southern, East Coast and Northern). […] *The official T&C states prize categories \"will be announced by Giant Malaysia\"; the breakdown above is from the official campaign poster.*"
```

## Worked example 2 — validated 2026-07-13 (NTPM Jom Cuti-Cuti Malaysia, lite flow)

Human supplied the official post + site; everything else was shell — two
`curl` commands fetched the 23-page T&C PDF ("Terma dan Syarat" footer link
on ntpmcontest2026.mypromotions.my, hosted on the **mypromotions.my** contest
platform) and the 2560×1200 web banner. Findings that shaped the prompts:

- the site's other images (`left-img.png`/`right-img.png`) were **stale
  template assets from a different brand's campaign** (BRAND'S Essence of
  Chicken) — hence the "view each image, delete strays" step;
- the T&C never states a total prize value (tiers sum to ≈ RM74,000) —
  `total_prizes_value_rm` correctly omitted per the BUILD rules;
- `contest.json` (EN+MS, 28 fields) again passed the admin importer with
  0 errors / 0 missing / 0 over-limit.
