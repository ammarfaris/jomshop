# `ai-assist/` — contest-ingestion prompts for the AI

Two parallel strategies for turning one Malaysian contest's TnC into a
**draft** contest in the Admin panel. Both produce the same JSON payload (the
`ingest-contest` contract, see the parent
[`../README.md`](../README.md)) and both land the contest as
`visibility = 'admin'` — a human always approves before it goes live.

| | [`autoclaw-needs-tuning/`](./autoclaw-needs-tuning/) | [`direct-prompting-end-to-end/`](./direct-prompting-end-to-end/) |
| --- | --- | --- |
| Runtime | **shell-equipped AI** (Cursor, Claude Code, OpenClaw, AutoClaw) — needs a logged-in browser for FB/IG too | **shell-equipped AI** (Cursor, Claude Code, OpenClaw, AutoClaw) — curl + `pdftotext` only, no browser |
| Also embeds | **Prompt B** for hosted chatbots (Gemini / ChatGPT web) — JSON only, no submit | **Batch mode** ([`BATCH.md`](./direct-prompting-end-to-end/BATCH.md)) — N URLs in one Cursor turn, for request-capped plans |
| Best for | Facebook / Instagram / aggregator leads, QR-decode trails, anything behind a login or Cloudflare wall | Direct campaign microsites (`brand.com.my/campaigns/…`, `mypromotions.my`, WordPress TnC pages, PDF TnCs) |
| Status | ⚠️ **needs tuning** — AutoClaw still cannot reliably grab images from Facebook posts; the prompts are the contract, the runtime needs work | ✅ **validated 2026-07-13** on the NTPM contest — see [`direct-prompting-end-to-end/trial/`](./direct-prompting-end-to-end/trial/) |
| Files | `PROMPT.md`, `SCOUT.md`, `scout-prompt.md`, `scout-lite-prompt.md` | `PROMPT.md` (single), `BATCH.md` (queue), `trial/` (worked example) |

> **Gemini / ChatGPT web users**: neither folder's end-to-end prompt works
> there — they need a shell. Use **Prompt B** instead (in
> [`autoclaw-needs-tuning/PROMPT.md`](./autoclaw-needs-tuning/PROMPT.md), or
> via Admin → Create Contest → **Copy AI Prompt**): paste it + the TnC, get
> JSON back, then **Paste JSON** / **Import (.json)** in Admin. No key, no
> shell.

## Which one should I reach for?

- Have a **direct campaign URL** that curl can fetch cleanly (no Cloudflare,
  no JS-rendered shell)? → `direct-prompting-end-to-end/`. Faster, cheaper,
  no tokens spent on browser automation.
  - **One URL** → use [`PROMPT.md`](./direct-prompting-end-to-end/PROMPT.md).
  - **Many URLs at once** (clearing a backlog, request-capped plan) → use
    [`BATCH.md`](./direct-prompting-end-to-end/BATCH.md). It processes the
    whole queue in one Cursor turn, with continue-on-error.
- Have a **Facebook / Instagram post**, or the campaign page is bot-blocked?
  → `autoclaw-needs-tuning/`. The flow works (validated on the Giant /
  Nestlé contest on 2026-07-11); AutoClaw's image-grab from FB is what still
  needs fixing.
- Only have a **browser chatbox** (Gemini, ChatGPT, Claude.ai web)? → use
  **Prompt B** from `autoclaw-needs-tuning/` and submit the JSON yourself
  via the Admin UI's Paste JSON / Import (.json). No shell, no key, full
  human review.

## Shared infrastructure

Both flows submit to the same Edge Function and use the same shared secret.

- **Edge Function**: `POST /functions/v1/ingest-contest` — see
  [`../README.md`](../README.md) and [`../index.ts`](../index.ts).
- **Ingest key**: `~/JomContest/.env` containing
  `INGEST_CONTEST_KEY=<the secret set in Supabase>`. Both prompts' SUBMIT
  snippets source this file at run time, so you can **rotate** the key any
  time without touching the prompts (see
  [`direct-prompting-end-to-end/PROMPT.md`](./direct-prompting-end-to-end/PROMPT.md#one-time-key-setup-same-file-as-the-autoclaw-flow)
  for the rotation steps).
- **Safety invariant**: every ingest path lands the contest as
  `visibility = 'admin'`. The function hard-codes this; **no agent can
  publish a contest** — only a human admin can flip visibility to
  `users` / `any` in `/admin`.

## Safety: agent = draft factory, never author

| Who/what | Can create a draft | Can publish |
| --- | --- | --- |
| AutoClaw agent (shared secret) | ✅ | ❌ |
| Direct-prompting curl flow (shared secret) | ✅ | ❌ |
| Browser chatbot (Prompt B — no key) | ❌ (outputs JSON only) | ❌ |
| Human admin (JWT, in `/admin`) | ✅ | ✅ |

The agent never sees the publish endpoint, the publish endpoint requires a
human admin's JWT, and the Edge Function ignores any visibility the agent
tries to set. Three independent guards on the same invariant.
