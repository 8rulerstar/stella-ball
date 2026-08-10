#!/usr/bin/env python3
"""Build idle, move, attack and hit sheets for the 20-unit Prism roster.

The source is five generated 2x2 portrait atlases. This script extracts each
character losslessly, then makes deterministic four-frame pixel animations so
every unit shares the same state contract without changing its identity.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "characters" / "expanded" / "source"
OUT = ROOT / "assets" / "characters" / "expanded" / "animations"
FRAME = 256
CELL = 627

UNITS = [
    ("mira", "set-01", 0, 0, "#f2b4ff"), ("orbit", "set-01", 1, 0, "#70dce1"),
    ("kain", "set-01", 0, 1, "#8eeaff"), ("bella", "set-01", 1, 1, "#c6a7ff"),
    ("luka", "set-02", 0, 0, "#ff9d64"), ("sein", "set-02", 1, 0, "#b7d8ff"),
    ("dora", "set-02", 0, 1, "#ffcf6d"), ("kai", "set-02", 1, 1, "#ff7fc8"),
    ("echo", "set-03", 0, 0, "#a9d1ff"), ("rin", "set-03", 1, 0, "#93ecff"),
    ("tor", "set-03", 0, 1, "#ffad61"), ("nabi", "set-03", 1, 1, "#ff9bda"),
    ("io", "set-04", 0, 0, "#ffe17b"), ("lev", "set-04", 1, 0, "#ef6b7a"),
    ("yuna", "set-04", 0, 1, "#9de67b"), ("zero", "set-04", 1, 1, "#a886ff"),
    ("pia", "set-05", 0, 0, "#ffb4e6"), ("mar", "set-05", 1, 0, "#ff7d55"),
    ("sia", "set-05", 0, 1, "#a9b9ff"), ("atlas", "set-05", 1, 1, "#e6b4ff"),
]


def rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def trim(image: Image.Image) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    return image.crop(bbox) if bbox else image


def scale(image: Image.Image, amount: float) -> Image.Image:
    return image.resize((max(1, round(image.width * amount)), max(1, round(image.height * amount))), Image.Resampling.NEAREST)


def base_unit(set_name: str, col: int, row: int) -> Image.Image:
    atlas = Image.open(SOURCE / f"{set_name}.png").convert("RGBA")
    crop = atlas.crop((col * CELL, row * CELL, (col + 1) * CELL, (row + 1) * CELL))
    unit = trim(crop)
    return scale(unit, min(184 / unit.width, 205 / unit.height))


def white_flash(image: Image.Image, strength: float) -> Image.Image:
    flash = Image.new("RGBA", image.size, (255, 235, 255, 0))
    flash.putalpha(image.getchannel("A").point(lambda value: round(value * strength)))
    return Image.alpha_composite(image, flash)


def frame_for(unit: Image.Image, state: str, index: int, color: str) -> Image.Image:
    frame = Image.new("RGBA", (FRAME, FRAME))
    color_rgba = rgba(color)
    draw = ImageDraw.Draw(frame)
    if state == "idle":
        scales, offsets = (0.98, 1.01, 1.0, 0.97), ((0, 7), (0, 2), (0, 0), (0, 4))
        sprite = scale(unit, scales[index])
    elif state == "move":
        scales, offsets = (0.98, 1.0, 0.99, 1.02), ((-18, 7), (-6, 1), (9, 5), (20, 0))
        sprite = scale(unit, scales[index])
        draw.line((24, 218, 108 + index * 20, 218), fill=rgba(color, 120), width=3)
    elif state == "attack":
        scales, offsets = (0.95, 0.99, 1.13, 1.02), ((-8, 7), (-15, 4), (18, -4), (5, 1))
        sprite = scale(unit, scales[index])
        if index in (2, 3):
            radius = 24 + index * 12
            draw.ellipse((128 - radius, 116 - radius, 128 + radius, 116 + radius), outline=rgba(color, 185), width=4)
            draw.line((126, 113, 216, 77), fill=rgba(color, 220), width=5)
    else:  # hit
        scales, offsets = (1.0, 0.95, 1.06, 0.99), ((0, 3), (15, 7), (-14, -2), (4, 3))
        sprite = scale(unit, scales[index])
        if index in (1, 2):
            sprite = white_flash(sprite, 0.72 if index == 1 else 0.36)
            draw.line((72, 44, 184, 204), fill=rgba(color, 145), width=4)
    x = (FRAME - sprite.width) // 2 + offsets[index][0]
    y = (FRAME - sprite.height) // 2 + offsets[index][1]
    frame.alpha_composite(sprite, (x, y))
    return frame


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    entries = []
    for unit_id, set_name, col, row, color in UNITS:
        unit = base_unit(set_name, col, row)
        for state in ("idle", "move", "attack", "hit"):
            sheet = Image.new("RGBA", (FRAME * 4, FRAME))
            for index in range(4):
                sheet.alpha_composite(frame_for(unit, state, index, color), (FRAME * index, 0))
            filename = f"{unit_id}-{state}.png"
            sheet.save(OUT / filename)
            entries.append({"id": unit_id, "state": state, "file": f"characters/expanded/animations/{filename}", "frames": 4, "frameWidth": FRAME, "frameHeight": FRAME, "fps": 7})
    (OUT / "manifest.json").write_text(json.dumps({"schemaVersion": 1, "pixelArt": True, "animations": entries}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    build()
