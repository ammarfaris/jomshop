# JomContest branding pipeline

Guide written for an AI assistant (or a human) regenerating brand assets. Read this fully before touching anything.

## What this is

The JomContest logo was originally **painted by an image-generation model** — its letterforms are not any font. This pipeline vectorizes that raster reference into layered SVG masters (exact Bézier clones of the painted glyphs) and regenerates every icon/splash/favicon the apps use. Nothing here renders text with a font except the fake UI labels inside the preview mockups.

**Source of truth:** `masters/jomcontest-reference-ai.png` (1024², green "jom" + charcoal "contest" pill + green exclamation, white bg). Never overwrite it. If a new reference image is ever adopted, replace that file and re-run the whole pipeline.

**Folder layout:** `masters/` holds the reference raster + the SVG masters (the editable brand sources); `generated/` holds rendered PNG reviews and previews; `build/` is gitignored intermediates. App-consumed assets are written directly into `apps/expo` and `apps/next`.

**Brand rules currently in force:**
- Home-screen icon, splash, apple-touch-icon → **full lockup** (jom + contest pill + !).
- App icons/splash build from the **short-excl master** (approved 2026-07-10): exclamation dot bottom level with the pill bottom. `jomcontest-logo.svg` (exact trace) stays as ground truth only.
- Web navbar (`apps/next/public/logo{,-dark}.svg`) → **one-line lockup** (`oneline` master): "jom!" + contest pill on one line, fits the 40px header.
- Favicons (`favicon.ico`, expo `favicon.png`, next `icon.png`) → **compact "jom!" only, no pill**. Its exclamation dot is sized off the j's dot (1.1×) so it never reads smaller than the letter's dot.
- **Dark mode**: green stays; the charcoal pill flips to near-white `#F3F5F7` with charcoal text (`*-dark.svg` masters). Light/dark logo pairs are wired in-app: Next navbar uses `public/logo.svg` + `public/logo-dark.svg` swapped with Tailwind `dark:` classes (`apps/next/app/navbar.tsx`, two places incl. maintenance mode); the Expo tabs header uses `assets/images/logo-{light,dark}.png` picked via `useColorScheme` (`apps/expo/app/(tabs)/_layout.tsx` HeaderTitle).
- Brand colors are *sampled from the reference*, not hardcoded: green `#0E9C47`, charcoal `#222A36` (stage 1 writes `build/colors.json`).

## Files

| file | role |
|---|---|
| `1-make-masks.py` | color-separates the reference into 1-bit masks (`build/mask-*.png`) + samples colors |
| `2-trace-masters.mjs` | potrace → layered SVG masters in `masters/` (incl. variants) |
| `3-render-assets.mjs` | renders all app assets + per-master review PNGs + 3-panel preview |
| `4-make-ico.py` | bundles `apps/next/app/favicon.ico` (16/32/48) |
| `build/` | intermediates, gitignored |

Masters written to `masters/`:
- `jomcontest-logo.svg` — exact trace of the reference (exclamation overshoots top and bottom, as painted)
- `jomcontest-logo-compact.svg` — "jom!" favicon variant (excl fitted word-top→baseline, width kept chunky)
- `jomcontest-logo-short-excl.svg` — production lockup: excl dot bottom level with pill bottom, bar shortened at the bottom by the same delta
- `jomcontest-logo-short-excl-dark.svg` — dark-mode version of the production lockup
- `jomcontest-logo-oneline.svg` — one-line lockup "jom! contest": compact-style short excl, pill scaled to the x-height band sitting a word-space to the right
- `jomcontest-logo-oneline-dark.svg` — dark-mode version of the one-line lockup

Each master: named layer groups (`#jom`, `#exclamation` → `#excl-bar`/`#excl-dot`, `#contest-pill` → `#pill`/`#contest-text`) — Illustrator and Figma open them directly — plus a `data-bbox="x1 y1 x2 y2"` attribute (tight content bounds) that stage 3 requires for placement. **If you hand-edit an SVG's geometry, keep `data-bbox` accurate.**

## How to run

```bash
cd tools/branding
npm install                      # first time only
python3 -c "import PIL, numpy"   # else: pip3 install pillow numpy
npm run all                      # masks → trace → render → ico
```

App assets default to the short-excl master. To build from a different full-lockup master (e.g. to compare against the exact trace):

```bash
MASTER=jomcontest-logo.svg npm run render && npm run ico
```

## Verification (do not skip)

1. Open `generated/jomcontest-logo.png` next to `masters/jomcontest-reference-ai.png` — they must be visually identical (only margins may differ).
2. Check `generated/preview-jomcontest-vector.png`: all three panels (home-screen icon, splash, web header) must show the **full lockup**; nothing may be clipped. Also eyeball `generated/*-dark.png` (rendered on a dark bg).
3. Stage 2 must log `2 exclamation subpaths`; a warning means the mask classification broke — inspect `build/mask-green.png`.
4. Stage 4 asserts the `.ico` contains all three frames.
5. Icon changes ship in the **native binary**: tell the user an `eas build` (not OTA) is needed for iOS/Android.

## Gotchas learned the hard way

- **Never pipe stage output through `head`** — SIGPIPE kills node mid-write and leaves stale assets. Redirect to a file if you must truncate.
- The dark mask needs the **green-halo cleanup** (see stage 1): antialiased edges of green letters are dark enough to leak into it. The criterion must be *strict* green dominance `(g - max(r,b)) > 0`; adding an offset there once wiped the whole pill mask.
- iOS `icon.png` must be **opaque** (white bg baked in). Android adaptive foreground must fit the central 66% safe circle — stage 3 fits by diagonal, don't "fix" it to fit by width.
- potrace here is the pure-JS npm package; `turdSize 90` (at 2048px) removes speckle. If future masks are noisier, raise it before adding cleanup passes.
- `apps/expo/app.json` already wires `icon`, `android.adaptiveIcon`, and the `expo-splash-screen` plugin to these asset paths — if you rename outputs, update it.

## Making a new variant (recipe)

Add a block at the bottom of `2-trace-masters.mjs`: reuse the traced `bar`, `dot`, `pill`, `letters` shapes and apply `transform` on the parts (translate/scale about a fixed edge — see the short-excl block for scaling a shape about its own top). Write it with `writeMaster('jomcontest-logo-<variant>.svg', bbox, layers)`; stage 3 automatically renders a 1024px review PNG for every `jomcontest-logo*.svg`. Keep the exact-trace master untouched so there is always a ground truth.
