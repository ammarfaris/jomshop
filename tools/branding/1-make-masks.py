#!/usr/bin/env python3
"""Stage 1: color-separate the AI-painted logo reference into 1-bit trace masks.

Input : masters/jomcontest-reference-ai.png (green wordmark + charcoal pill, white bg)
Output: build/mask-green.png         green marks (jom letters + exclamation)
        build/mask-pill-solid.png    contest pill silhouette, text holes filled
        build/mask-contest-white.png the white "contest" glyphs
All masks are shapes-black-on-white at 2048px (2x upscale smooths the trace).

Requires: pillow, numpy  (pip install pillow numpy)
"""
import os
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "masters/jomcontest-reference-ai.png")
OUT = os.path.join(HERE, "build")
os.makedirs(OUT, exist_ok=True)

src = Image.open(SRC).convert("RGB")
a = np.asarray(src).astype(int)
r, g, b = a[..., 0], a[..., 1], a[..., 2]

# Soft scores preserve antialiased edges; thresholding happens after the 2x upscale.
green = np.clip((g - np.maximum(r, b) - 8) * 6, 0, 255).astype(np.uint8)
lum = 0.299 * r + 0.587 * g + 0.114 * b
dark = np.clip((120 - lum) * 6, 0, 255).astype(np.uint8)

# Dark antialiased fringes around green letters would leak into the dark mask.
# Kill anything near strictly-greenish pixels (charcoal has g < max(r,b), so it is safe).
green_soft = np.clip((g - np.maximum(r, b)) * 12, 0, 255).astype(np.uint8)
halo = np.asarray(Image.fromarray(green_soft).filter(ImageFilter.MaxFilter(9)))
dark = np.where(halo > 60, 0, dark).astype(np.uint8)

def to2048(arr):
    im = Image.fromarray(255 - arr).resize((2048, 2048), Image.LANCZOS)
    return im.point(lambda p: 0 if p < 128 else 255).convert("L")

to2048(green).save(f"{OUT}/mask-green.png")
dm = to2048(dark)

# Pill with text holes filled: flood the outside; whatever the flood can't reach is pill interior.
flood = dm.copy()
ImageDraw.floodfill(flood, (0, 0), 128)
solid = np.asarray(flood)
pill_solid = np.where(solid == 128, 255, 0).astype(np.uint8)
Image.fromarray(pill_solid).save(f"{OUT}/mask-pill-solid.png")

# White "contest" glyphs = inside the solid pill but not dark.
letters = np.where((pill_solid == 0) & (np.asarray(dm) == 255), 0, 255).astype(np.uint8)
Image.fromarray(letters).save(f"{OUT}/mask-contest-white.png")

# Exact brand colors, sampled from the reference itself.
gm = np.asarray(Image.fromarray(green)) > 200
dkm = (lum < 80) & ~gm
green_hex = "#%02X%02X%02X" % tuple(int(a[..., i][gm].mean()) for i in range(3))
dark_hex = "#%02X%02X%02X" % tuple(int(a[..., i][dkm].mean()) for i in range(3))
with open(f"{OUT}/colors.json", "w") as f:
    f.write('{"green": "%s", "charcoal": "%s"}\n' % (green_hex, dark_hex))

for f in ["mask-green.png", "mask-pill-solid.png", "mask-contest-white.png"]:
    n = int((np.asarray(Image.open(f"{OUT}/{f}")) < 128).sum())
    assert n > 10000, f"{f} looks empty ({n} px) — mask separation failed"
    print(f, n, "black px")
print("colors:", green_hex, dark_hex)
