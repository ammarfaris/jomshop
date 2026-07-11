#!/usr/bin/env python3
"""Stage 4: assemble apps/next/app/favicon.ico from the stage-3 frames (16/32/48)."""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
frames = [Image.open(f"{HERE}/build/fav-{s}.png") for s in (16, 32, 48)]
out = os.path.join(HERE, "../../apps/next/app/favicon.ico")
frames[2].save(out, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)], append_images=frames[:2])
img = Image.open(out)
assert img.info.get("sizes") == {(16, 16), (32, 32), (48, 48)}, "favicon.ico is missing frames"
print("wrote apps/next/app/favicon.ico with frames", sorted(img.info["sizes"]))
