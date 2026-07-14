# `autoclaw-needs-tuning/` — browser-assisted AutoClaw pipeline

Status: ⚠️ **needs tuning.** AutoClaw (Z.AI's packaged OpenClaw distribution)
still cannot reliably grab full-resolution images from Facebook posts. The
prompts in this folder are the **contract** — what the run *should* produce —
but the agent runtime needs work before this flow is reliable.

For direct campaign websites (no Facebook, no Cloudflare), use
[`../direct-prompting-end-to-end/`](../direct-prompting-end-to-end/) instead —
it's curl-only and already validated.

## When this is still the right tool

- Your lead is a **Facebook / Instagram / TikTok / X post** — login-gated,
  so curl cannot fetch it.
- The campaign page is **bot-blocked** (Cloudflare challenge, JS-rendered
  shell).
- You need to follow a **QR-code trail** that starts on a printed poster.

For each, see the relevant scenario in [`SCOUT.md`](./SCOUT.md).

## The flow

```
lead URL (FB/IG post, or campaign URL)
   │
   ├──▶ Prompt S (scout) ──▶ ~/JomContest/inbox/<slug>/   (review package)
   │       full:  scout-prompt.md
   │       lite:  scout-lite-prompt.md    ◀── default while tokens are tight
   │
   │                          review package files:
   │                          contest.json · tnc-official.{pdf,md,txt}
   │                          images/   · lead.md
   │
   ├──▶ Prompt A   ──▶ build contest.json + SUBMIT (agent builds + posts)
   ├──▶ Prompt A½  ──▶ SUBMIT only (human supplies the JSON)
   └──▶ Prompt B   ──▶ browser chatbot builds JSON (no submit; copy into Admin)
```

## Files

| File | What |
| --- | --- |
| [`PROMPT.md`](./PROMPT.md) | Prompt A (Mac-Mini agent end-to-end) and Prompt A½ (agent just submits a ready JSON). The single home of the convert-and-submit prompts. |
| [`SCOUT.md`](./SCOUT.md) | The human-facing guide to the scout flow: setup, first run, review/import checklist, two worked examples. |
| [`scout-prompt.md`](./scout-prompt.md) | Prompt S **full** — agent discovers everything from a lead URL and builds `contest.json`. |
| [`scout-lite-prompt.md`](./scout-lite-prompt.md) | Prompt S **lite** — human supplies the URLs, agent only fetches and files. Token-saving default. |

## Why it's "needs-tuning"

Validated **2026-07-11** against the Giant × Nestlé "Supermarket Sweep"
contest (FB lead → bit.ly → giant.com.my → TnC). The agent correctly
discovered the TnC and built a clean `contest.json`, but:

- Image grabs from the Facebook post were unreliable — the
  `scontent…fbcdn.net` CDN URL carries a signed, expiring token that the
  agent sometimes failed to read in time, falling back to lower-quality
  screenshots or missing the poster entirely.
- Cloudflare and "verify you're human" walls on some aggregator pages
  occasionally derailed the browsing loop.

The contract (the prompt) is correct — the failure mode is in AutoClaw's
browser automation. Until that's fixed, prefer the **lite + Prompt B** path
documented in [`SCOUT.md`](./SCOUT.md), or switch to
[`../direct-prompting-end-to-end/`](../direct-prompting-end-to-end/) for
campaigns you can reach with curl.
