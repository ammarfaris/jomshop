#!/usr/bin/env python3
"""Contest Host Logo Processor (Python sibling of process-logos.sh).

Behaviour mirrors `process-logos.sh` exactly:

  - Resize each input proportionally so its longest side fits a chosen content
    size (100..180 px, default 140 = "medium").
  - Center the result on a 200x200 canvas. Transparent background for raster
    inputs, white for SVGs (rasterized at 300 DPI).
  - Save as `logo-<size_name>-<basename>.png`.

Why a Python version exists
---------------------------
The bash version requires ImageMagick (`brew install imagemagick`). Pillow is
much easier to install ad-hoc, available on every CI runner, and works the
same on macOS, Linux, and Windows. Pick whichever is more convenient — the
output filenames and sizes are identical, so they live happily side by side.

Requirements
------------
  python3 -m pip install --user Pillow              # required
  python3 -m pip install --user cairosvg            # only if you have SVG inputs

Usage (matches process-logos.sh)
--------------------------------
  ./process-logos.py                              # all images, default medium
  ./process-logos.py file.png                     # single file
  ./process-logos.py file1.png file2.png          # multiple files
  ./process-logos.py --size x-small file.png      # 100x100 content
  ./process-logos.py --size small   file.png      # 120x120 content
  ./process-logos.py --size medium  file.png      # 140x140 content (default)
  ./process-logos.py --size large   file.png      # 160x160 content
  ./process-logos.py --size x-large file.png      # 180x180 content
  ./process-logos.py --size 150 file.png          # custom 100-180
  ./process-logos.py --help
"""

from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path
from typing import Iterable

# ---- Constants --------------------------------------------------------------

CANVAS = 200  # final output is always 200x200
SUPPORTED_EXTS = {".png", ".jpg", ".jpeg", ".svg"}
SIZE_ALIASES: dict[str, int] = {
    "x-small": 100, "xsmall": 100, "xs": 100,
    "small": 120,
    "medium": 140, "": 140,
    "large": 160,
    "x-large": 180, "xlarge": 180, "xl": 180,
}
SIZE_LABELS: dict[int, str] = {
    100: "x-small", 120: "small", 140: "medium", 160: "large", 180: "x-large",
}
PADDING_DESC: dict[int, str] = {
    100: "50px padding (extra small logo)",
    120: "40px padding (small logo)",
    140: "30px padding (medium logo)",
    160: "20px padding (large logo)",
    180: "10px padding (extra large logo)",
}

# ---- Tiny ANSI helpers (match the bash script's tone) -----------------------

def _supports_colour() -> bool:
    return sys.stdout.isatty()

class C:
    if _supports_colour():
        GREEN, BLUE, YELLOW, RED, CYAN, NC = (
            "\033[0;32m", "\033[0;34m", "\033[1;33m",
            "\033[0;31m", "\033[0;36m", "\033[0m",
        )
    else:
        GREEN = BLUE = YELLOW = RED = CYAN = NC = ""

# ---- CLI parsing ------------------------------------------------------------

def parse_size(value: str) -> int:
    """Map a --size argument to a content-size in pixels (100..180)."""
    key = value.strip().lower()
    if key in SIZE_ALIASES:
        return SIZE_ALIASES[key]
    if key.isdigit():
        n = int(key)
        if 100 <= n <= 180:
            return n
    print(
        f"{C.YELLOW}Invalid size '{value}', using default (140){C.NC}",
        file=sys.stderr,
    )
    return 140

def parse_args(argv: list[str]) -> tuple[int, list[Path]]:
    p = argparse.ArgumentParser(
        prog="process-logos.py",
        description="Resize logos to 200x200 with consistent padding.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Size options:\n"
            "  x-small (100x100) - Maximum padding, smallest logo\n"
            "  small   (120x120)\n"
            "  medium  (140x140) - default\n"
            "  large   (160x160)\n"
            "  x-large (180x180) - Minimum padding, largest logo\n"
            "  100..180          - Custom size in pixels"
        ),
    )
    p.add_argument(
        "--size", default="medium",
        help="Content size: x-small / small / medium / large / x-large / 100..180",
    )
    p.add_argument("files", nargs="*", help="Specific files (default: all in cwd)")
    ns = p.parse_args(argv)
    size_px = parse_size(ns.size)
    files = [Path(f) for f in ns.files]
    return size_px, files

# ---- File discovery ---------------------------------------------------------

def discover_files(specific: list[Path]) -> list[Path]:
    if specific:
        out: list[Path] = []
        for f in specific:
            if f.exists():
                out.append(f)
            else:
                print(f"{C.RED}✗ File not found:{C.NC} {f}")
        return out
    cwd = Path.cwd()
    return sorted(
        p for p in cwd.iterdir()
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTS
    )

def should_skip(file: Path) -> str | None:
    name = file.name
    if name.startswith("logo-"):
        return "already processed"
    if "-ok-aligned" in name:
        return "legacy processed file"
    return None

# ---- Image processing -------------------------------------------------------

def _ensure_pillow():
    try:
        from PIL import Image  # noqa: F401
    except Exception:
        print(
            f"{C.RED}Error: Pillow is not installed.{C.NC}\n"
            f"{C.YELLOW}Install it with: python3 -m pip install --user Pillow{C.NC}",
            file=sys.stderr,
        )
        sys.exit(1)

def _load_raster(file: Path):
    from PIL import Image
    img = Image.open(file)
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    return img

def _load_svg_as_raster(file: Path, content_size: int):
    """Rasterize an SVG at high resolution. White background, like ImageMagick's
    `-density 300 -background white` path."""
    try:
        import cairosvg
    except Exception:
        print(
            f"{C.RED}Error: SVG input requires `cairosvg`.{C.NC}\n"
            f"{C.YELLOW}Install it with: python3 -m pip install --user cairosvg{C.NC}\n"
            f"{C.YELLOW}Or convert {file.name} to a high-resolution PNG and re-run.{C.NC}",
            file=sys.stderr,
        )
        sys.exit(1)
    # Render at ~6x the content size for crisp downsampling.
    target = max(content_size * 6, 1200)
    png_bytes = cairosvg.svg2png(url=str(file), output_width=target)
    from PIL import Image
    img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    # Flatten onto white (matches `-background white` from the bash script).
    bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
    bg.alpha_composite(img)
    return bg

def fit_into_canvas(content_img, content_size: int, *, transparent: bool):
    """Resize image to fit `content_size`x`content_size` keeping aspect, then
    paste centered on a 200x200 canvas."""
    from PIL import Image
    img = content_img.copy()
    img.thumbnail((content_size, content_size), Image.LANCZOS)
    if transparent:
        canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    else:
        canvas = Image.new("RGBA", (CANVAS, CANVAS), (255, 255, 255, 255))
    x = (CANVAS - img.width) // 2
    y = (CANVAS - img.height) // 2
    canvas.alpha_composite(img, dest=(x, y))
    return canvas

def process_one(file: Path, size_px: int) -> Path | None:
    size_name = SIZE_LABELS.get(size_px, f"{size_px}px")
    output = file.with_name(f"logo-{size_name}-{file.stem}.png")

    print(f"\n{C.BLUE}{'━' * 40}{C.NC}")
    print(f"{C.BLUE}Processing:{C.NC} {file.name}")
    pad_desc = PADDING_DESC.get(size_px, f"{(CANVAS - size_px) // 2}px padding")
    print(f"{C.CYAN}  → Size: {size_px}x{size_px}px ({pad_desc}){C.NC}")

    try:
        is_svg = file.suffix.lower() == ".svg"
        if is_svg:
            print(f"{C.YELLOW}  → SVG detected, rasterizing at high DPI...{C.NC}")
            content = _load_svg_as_raster(file, size_px)
            canvas = fit_into_canvas(content, size_px, transparent=False)
        else:
            content = _load_raster(file)
            canvas = fit_into_canvas(content, size_px, transparent=True)
        canvas.save(output, format="PNG", optimize=True)
        print(
            f"{C.GREEN}✓ Created:{C.NC} {output.name} "
            f"({CANVAS}x{CANVAS}px, {size_px}x{size_px} content)"
        )
        return output
    except Exception as e:
        print(f"{C.RED}✗ Failed to process:{C.NC} {file.name} ({e})")
        return None

# ---- Main -------------------------------------------------------------------

def main(argv: Iterable[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    _ensure_pillow()
    size_px, specific = parse_args(argv)

    print(f"{C.BLUE}=== Contest Host Logo Processor (Python) ==={C.NC}")
    if size_px == 140 and "--size" not in argv:
        print(f"{C.CYAN}Mode: Default (medium size 140x140){C.NC}")
    else:
        print(f"{C.CYAN}Mode: Size specified ({SIZE_LABELS.get(size_px, str(size_px))}){C.NC}")
    if specific:
        print(f"{C.CYAN}Processing specific files: {' '.join(p.name for p in specific)}{C.NC}\n")
    else:
        print(f"{C.CYAN}Processing all image files in directory{C.NC}\n")

    files = discover_files(specific)
    processed = 0
    skipped = 0
    for file in files:
        skip_reason = should_skip(file)
        if skip_reason:
            print(f"{C.YELLOW}⊘ Skipping:{C.NC} {file.name} ({skip_reason})")
            skipped += 1
            continue
        if process_one(file, size_px):
            processed += 1

    print(f"\n{C.BLUE}{'━' * 40}{C.NC}")
    print(f"{C.BLUE}=== Summary ==={C.NC}")
    print(f"{C.GREEN}Processed: {processed} files{C.NC}")
    if skipped:
        print(f"{C.YELLOW}Skipped: {skipped} files (already processed){C.NC}")

    if processed == 0:
        print(f"\n{C.YELLOW}No new files were processed.{C.NC}")
        if specific:
            print(f"{C.YELLOW}The specified files may already be processed or not found.{C.NC}")
            print(f"{C.YELLOW}Delete existing 'logo-*.png' files to reprocess them.{C.NC}")
        else:
            print(f"{C.YELLOW}Make sure you have image files (png, jpg, svg) in this directory.{C.NC}")
            print(f"{C.YELLOW}Or delete existing 'logo-*.png' files to reprocess them.{C.NC}")
    else:
        print(f"\n{C.GREEN}✓ All logos processed successfully!{C.NC}")
        print(f"{C.BLUE}Upload the 'logo-*.png' files to Appwrite's contestHostsBucket.{C.NC}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
