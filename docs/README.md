# JomContest Docs

Curated documentation for the JomContest app. Everything here is expected to
describe the **current** state of the codebase — not the history of how it got
there.

## Maintenance policy

1. **Update docs in the same change as the code.** If a change touches a
   feature documented here, update (or delete) the affected doc in the same
   commit/PR. The `/pre-commit` command checks this.
2. **No session logs.** Implementation summaries, bug-hunt narratives,
   "what was implemented" write-ups, changelogs, and testing checklists from
   a single working session do not belong here. Git history and PR
   descriptions serve that purpose.
3. **One doc per topic.** Prefer updating the existing doc over adding a
   QUICK_REFERENCE / SUMMARY / GUIDE variant of the same content.
4. **Delete superseded docs.** A stale doc is worse than no doc.
5. Agent-facing conventions live in the root `AGENTS.md`, not here.

## Index

### Features (`features/`)

| Doc | Topic |
| --- | --- |
| `color-theme/COLOR_THEME_IMPLEMENTATION.md` | Web-only green/blue/purple accent themes (CSS variables) |
| `theme-switcher/IMPLEMENTATION_GUIDE.md` | Light/dark/system mode across web (next-themes) and native (Uniwind) |
| `document-scanner/README.md` | Web receipt scanner (opencv-document-scanner) |
| `document-scanner/QUALITY_ENHANCEMENTS.md` | Image enhancement pipeline details |
| `document-scanner/MOBILE_TESTING.md` | Testing camera features on mobile browsers (HTTPS) |
| `drag-and-drop/USAGE_GUIDE.md` | Admin badge reordering (Pragmatic Drag and Drop) |
| `markdown-text/MARKDOWN_LINKS_README.md` | Markdown links in contest fields (`MarkdownText`) |
| `profile-text-scale/TEXT_SCALE.md` | User-adjustable base font size |
| `upload-receipts/FILENAME_CONVENTION.md` | Receipt filename standardization |

### Fixes (`fixes/`)

Root-cause write-ups for non-obvious behavior that still exists in the code.
See `fixes/README.md` for the index.

### General (`general/`)

| Doc | Topic |
| --- | --- |
| `ENVIRONMENT_VARIABLES.md` | All env vars (Supabase, Turnstile, Meilisearch, ...) |
| `CAPTCHA_SECURITY.md` | CAPTCHA verification architecture |
| `ATTACK_EXAMPLE.md` | Why server-side protections exist (RLS bypass example) |
| `CLEANUP_STRATEGIES.md` | rate_limits / suspicious_activity table cleanup |

### Known issues (`important/`)

| Doc | Topic |
| --- | --- |
| `general-known-issues/IOS_WHATSAPP_SHARING_ISSUE.md` | iOS share-sheet → WhatsApp limitation |

### Branding (`branding/`)

Logo/branding concepts and in-context previews (app icon, splash, favicon)
for the JomContest → Jom! brand direction.
