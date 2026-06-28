# Contest Host Logos (dev tooling)

This folder holds **source artwork and processing scripts** for the logos that
appear next to contest hosts. The processed `logo-*.png` files are uploaded
manually to Appwrite's `contestHostsBucket`; nothing here is bundled into the
deployed Next.js app — it's intentionally outside `apps/next/public/` to keep
the production bundle lean.

## Quick Start

Two interchangeable scripts live in this folder. Pick whichever is easier to install:

| Script | Requires | When to prefer |
|---|---|---|
| `process-logos.sh` | ImageMagick (`brew install imagemagick`) | macOS dev with Homebrew |
| `process-logos.py` | Pillow (`python3 -m pip install --user Pillow`) — plus `cairosvg` for SVG | Anywhere Python is — Linux servers, CI, fresh machines, no Homebrew |

Both produce **identical filenames and sizes** (`logo-<size>-<basename>.png`, 200×200), so you can mix and match across the team.

```bash
# Navigate to this directory
cd tools/contests-logos

# Bash + ImageMagick (original)
./process-logos.sh                              # all images, default medium
./process-logos.sh file.png                     # single file
./process-logos.sh file1.png file2.png          # multiple files
./process-logos.sh --size x-small file.png      # 100x100
./process-logos.sh --size small   file.png      # 120x120
./process-logos.sh --size medium  file.png      # 140x140 (default)
./process-logos.sh --size large   file.png      # 160x160
./process-logos.sh --size x-large file.png      # 180x180
./process-logos.sh --size 150 file.png          # Custom 100..180
./process-logos.sh --help

# Python + Pillow (no Homebrew needed)
./process-logos.py                              # same flags & output
./process-logos.py --size large hsbc.png
./process-logos.py --help
```

**What both scripts do:**

- Process PNG, JPG, JPEG, and SVG files.
- Create `logo-[size]-[filename].png` versions (200×200, centered, transparent).
- Skip already-processed files (anything starting with `logo-` or containing `-ok-aligned`).
- SVG files are rasterized to PNG first, on a white background.

**Requirements:**

- For `process-logos.sh`: ImageMagick (`brew install imagemagick`).
- For `process-logos.py`: Pillow (`python3 -m pip install --user Pillow`).
  Add `cairosvg` (`python3 -m pip install --user cairosvg`) only if your input is SVG.

## Size Options & Padding

All logos are output as 200x200px images. The size parameter controls how large the logo appears within this canvas:

**Padding calculation:** `(200px - logo_size) ÷ 2 = padding_per_side`

| Size Option | Logo Size | Padding | Use Case |
|-------------|-----------|---------|----------|
| `x-small` | 100x100px | 50px | Maximum padding, smallest logos |
| `small` | 120x120px | 40px | More padding, smaller logos |
| `medium` | 140x140px | 30px | Balanced (default) |
| `large` | 160x160px | 20px | Less padding, larger logos |
| `x-large` | 180x180px | 10px | Minimum padding, largest logos |
| Custom `100-180` | 100-180px | 10-50px | Precise control |

**Why 100px minimum?** Anything smaller would create excessive padding (>50px), making logos too small to be effective.

## Output

The script creates `logo-[size]-[filename].png` files:

- `shell.png` → `logo-medium-shell.png` (200x200px, centered)
- `logo.png --size large` → `logo-large-logo.png`
- `image.png --size 150` → `logo-150px-image.png`

Upload the `logo-*.png` versions to Appwrite's `contestHostsBucket`.

## Troubleshooting

**Script not executable?**

```bash
chmod +x process-logos.sh process-logos.py
```

**ImageMagick not installed?** (bash version)

```bash
brew install imagemagick
```

**Pillow not installed?** (Python version)

```bash
python3 -m pip install --user Pillow
# only needed if your input is SVG:
python3 -m pip install --user cairosvg
```

**SVG looks wrong?** Use a PNG version instead (at least 500px resolution).
ImageMagick uses `librsvg`; the Python path uses `cairosvg`. They usually agree
but advanced SVG features (filters, certain gradients) may render slightly
differently. For consumer-facing host logos this is rarely a problem.
