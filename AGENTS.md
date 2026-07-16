# JomContest — Agent Notes

Facts an AI agent needs to work on this repo without re-discovering them.

## Stack (load-bearing facts)

- **Monorepo**: Yarn 4 workspaces — `apps/expo` (native), `apps/next` (web),
  `packages/app` (shared UI/business logic; most code lives here).
- **Native**: Expo SDK 57, expo-router, React Native 0.86, React 19.2.
  Development uses **Expo Go** (no `expo-dev-client`). `ios/` is gitignored
  (Continuous Native Generation) — regenerate with `npx expo prebuild -p ios`.
- **Web**: Next.js (app router) + Solito for cross-platform navigation.
- **Styling**: Tailwind CSS v4. Native uses **Uniwind** (`uniwind`); web uses
  plain Tailwind + next-themes. NativeWind was fully phased out — never
  reference or reintroduce it. Design tokens: `packages/app/styles/tokens.css`
  (base green scheme, both platforms). Web-only color themes (green/blue/purple
  `--main` overrides): `apps/next/app/globals.css`.
- **Backend**: **Supabase only** (Auth, Postgres + RLS, Storage, Edge
  Functions). Appwrite was decommissioned; treat any Appwrite reference as
  dead code. Search: Meilisearch. CAPTCHA: Cloudflare Turnstile.
- **i18n**: Lingui (`yarn extract`, `yarn compile` at repo root).

## Commands

- `yarn native` — Expo dev server (port 19001; use `yarn tunnel` in
  `apps/expo` when testing Google OAuth on a device, see below)
- `yarn web` — Next.js dev server
- `yarn workspace app test` — Jest tests for the shared package
- Typecheck an app: `yarn tsc --noEmit` inside `apps/expo` or `apps/next`
- `yarn sync-ingest-prompts` — after editing the fenced prompt in
  `supabase/functions/ingest-contest/ai-assist/direct-prompting-end-to-end/PROMPT.md`
  or `BATCH.md`, run this to regenerate
  `packages/app/features/admin/contestCursorPrompt.ts` and
  `contestCursorBatchPrompt.ts` (Admin **Copy AI Prompt** dropdown). Do not
  hand-edit the generated `.ts` files.

## Gotchas

- Google OAuth on native in Expo Go requires `expo start --tunnel`; Supabase
  rejects LAN-IP redirect URLs (see `ContinueWithGoogle.native.tsx`).
- `iconWithClassName` in `packages/app/components/icons-svg/utils/` is an
  intentional no-op kept for compatibility; icons are colored via
  `IconWrapper` props.
- Light/dark mode: native is Uniwind-backed
  (`packages/app/hooks/useColorScheme.native.ts`), web is next-themes-backed;
  cross-device sync via Supabase profile prefs (`useThemeSync`).

## Documentation policy

Curated docs live in `docs/` — see `docs/README.md` for the index and rules.
When you change code covered by a doc there, **update or delete that doc in
the same change**. Do not add session logs (implementation summaries, bug-hunt
narratives, one-off checklists) to `docs/`.

## Pre-commit gate

Before any **agent-initiated** `git commit`, run `/pre-commit` in chat. It
writes `.cursor/.pre-commit-passed` (gitignored); the
`beforeShellExecution` hook in `.cursor/hooks.json` validates that stamp.
Re-run `/pre-commit` if the working tree changes afterward. Hook smoke tests:
`bash .cursor/hooks/pre-commit-gate.test.sh`.
