# Contest .md Import (admin)

Lets an admin upload a single `.md` file in the **Create Contest** tab and have all
18 bilingual fields plus title, summary, dates and total prize value populated
automatically.

## Files (where to find what)

The files are split between two locations on purpose:

```
docs/features/contest-md-import/                    # private, not bundled in the deploy
├── README.md                                       (you're here)
├── perplexity-instructions.md                      # plain version
└── perplexity-instructions-v2.md                   # rich-markdown version (tables, emoji, ###)

apps/next/public/contest-md-import/                 # served at runtime
└── contest-template.md                             # fetched by the admin panel
```

- The **instructions files** are reference-only — you upload them to Perplexity once
  per contest. They have no reason to be served by the Next.js app, so they live
  under `docs/`.
- The **template file** is fetched at runtime by the admin panel's
  **Download .md Template** button (`/contest-md-import/contest-template.md`),
  so it must remain under `apps/next/public/` and stays publicly accessible.

## How to use (per contest)

1. Open Perplexity (or any LLM that accepts file uploads).
2. Attach **all three** files in the same chat:
   - `docs/features/contest-md-import/perplexity-instructions.md` *(or `-v2.md` for the rich-markdown variant — recommended)*
   - `apps/next/public/contest-md-import/contest-template.md`
   - the contest's T&C PDF.
3. Send a one-line message: **"Apply the instructions to the attached PDF and the
   attached template. Output `contest-import.md`."**
4. Download the resulting `contest-import.md`.
5. In the admin panel → **Create Contest** tab → click **Import T&C (.md)** →
   pick the file. The form populates and any over-limit / missing fields are
   surfaced via toasts.

Tip: if you don't have `contest-template.md` handy, click **Download .md Template**
in the admin panel — it fetches it straight from `apps/next/public/`.

## v1 vs v2 — which instructions file?

| File | Style |
|---|---|
| `perplexity-instructions.md` | Minimal markdown, mostly prose. Use when you want plain text in every section. |
| `perplexity-instructions-v2.md` | **Recommended.** Encourages tables for prizes / products / stores, `###` sub-headings, and a tasteful emoji palette (🏆 📅 ✅ ❌ etc.). The admin panel's `MarkdownText` renderer supports all of this. |

## Implementation pointers (for devs)

- Parser + runtime template fallback: `packages/app/features/admin/contestMarkdownIO.ts`.
- File picker + text reader: `packages/app/utils/filePicker.ts`
  (`pickMarkdownFile`, `readFileAsText`).
- UI wiring: `packages/app/features/admin/CreateContestTabContent.tsx`
  — buttons **Import T&C (.md)** and **Download .md Template** in the header.
- Section keys and per-field char limits live in `contestMarkdownIO.ts`
  (`CONTEST_MD_SECTION_KEYS`, `FIELD_LIMITS`) and must be kept in sync with
  `createContestSchema.ts`.

## Single source of truth

`apps/next/public/contest-md-import/contest-template.md` is the canonical template.
The web **Download .md Template** button fetches it directly. The runtime
`buildContestMarkdownTemplate()` in `contestMarkdownIO.ts` is only used as a
last-resort fallback (e.g. native admin where there's no obvious base URL, or
if the fetch fails). If you change the template structure, update **both** files.
