#!/usr/bin/env python3
"""Restyle the Tiny RPG orc into Taeo's battle sprite set.

Taeo was the only starkeeper on a Pawn (labourer) base, which read oddly next
to the knight and archer.  The approved direction keeps his blaster-smith role
but moves his body to the free Tiny RPG orc, recoloured from goblin green to a
warm bronze so he sits inside the Ink & Brass palette.

The orc is a 100px-cell micro sprite, so every frame is upscaled 4x with
nearest neighbour and cropped through one fixed 192px window (no per-frame
recentering, so the source animation offsets survive).  Outputs:

  assets/characters/taeo-orc-idle.png   6-frame idle, 192px cells
  assets/characters/anim/taeo-roll.png  4-frame tumble from the new idle
  assets/characters/anim/taeo-attack.png 4-frame axe swing from Orc-Attack01

Sources are read from the shared asset root (TS_ASSETS_DIR or D:/Assets or
~/Assets), folder "Tiny RPG Character Asset Pack*".
"""

from __future__ import annotations

import colorsys
from pathlib import Path

from PIL import Image

from generate_unit_action_sheets import HERO_COL, pack_root, pack_sheet, roll_frames

ROOT = Path(__file__).resolve().parents[1]
CELL = 100
OUT_CELL = 192
SCALE = 4
FOOT_ROW = 136  # matches the Tiny Swords idle baseline in a 192 cell
ATTACK_PICKS = [1, 2, 3, 4]


def orc_dir() -> Path:
    packs = pack_root()
    for cand in packs.glob("Tiny RPG Character Asset Pack*"):
        orc = cand / "Characters(100x100)" / "Orc" / "Orc"
        if orc.exists():
            return orc
    raise SystemExit(
        "Tiny RPG orc pack not found under the asset root. "
        "Set TS_ASSETS_DIR to the folder that contains it."
    )


def restyle(img: Image.Image) -> Image.Image:
    """Goblin green -> bronze skin; steel stays steel; the slash goes ember."""
    out = img.copy()
    px = out.load()
    cache: dict = {}
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a <= 0:
                continue
            key = (r, g, b)
            if key not in cache:
                h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                deg = h * 360
                if s < 0.16 and v > 0.78:
                    # slash effect / highlights: warm ember cream
                    nr, ng, nb = colorsys.hsv_to_rgb(38 / 360, min(1, s + 0.22), v)
                elif 55 <= deg <= 165 and s > 0.2:
                    # green skin family -> bronze, keeping the value ramp
                    nr, ng, nb = colorsys.hsv_to_rgb(
                        27 / 360, min(1, s * 0.96 + 0.05), min(1, v * 1.04)
                    )
                elif 166 <= deg <= 262:
                    # armour / axe steel: keep cool but calm it slightly
                    nr, ng, nb = colorsys.hsv_to_rgb(216 / 360, s * 0.62, v)
                else:
                    nr, ng, nb = r / 255, g / 255, b / 255
                cache[key] = (round(nr * 255), round(ng * 255), round(nb * 255))
            px[x, y] = cache[key] + (a,)
    return out


def frames_of(img: Image.Image) -> list[Image.Image]:
    return [
        img.crop((i * CELL, 0, (i + 1) * CELL, CELL))
        for i in range(img.width // CELL)
    ]


def window_from_idle(idle0: Image.Image) -> tuple[int, int]:
    bbox = idle0.getbbox()
    alpha = idle0.getchannel("A").load()
    total = weighted = 0
    for y in range(idle0.height):
        for x in range(idle0.width):
            if alpha[x, y] > 40:
                total += 1
                weighted += x
    cx = weighted / total if total else CELL / 2
    feet = bbox[3] * SCALE
    centre = cx * SCALE
    return int(centre - OUT_CELL / 2), int(feet - FOOT_ROW)


def through_window(frame: Image.Image, wx: int, wy: int) -> Image.Image:
    big = frame.resize((CELL * SCALE, CELL * SCALE), Image.NEAREST)
    cell = Image.new("RGBA", (OUT_CELL, OUT_CELL), (0, 0, 0, 0))
    cell.alpha_composite(big, (-wx, -wy))
    return cell


def main() -> None:
    src = orc_dir()
    idle_src = restyle(Image.open(src / "Orc-Idle.png").convert("RGBA"))
    attack_src = restyle(Image.open(src / "Orc-Attack01.png").convert("RGBA"))
    idle_frames = frames_of(idle_src)
    wx, wy = window_from_idle(idle_frames[0])
    idle = [through_window(f, wx, wy) for f in idle_frames]
    attack_all = frames_of(attack_src)
    attack = [
        through_window(attack_all[min(i, len(attack_all) - 1)], wx, wy)
        for i in ATTACK_PICKS
    ]
    (ROOT / "assets" / "characters" / "anim").mkdir(parents=True, exist_ok=True)
    pack_sheet(idle, OUT_CELL).save(ROOT / "assets" / "characters" / "taeo-orc-idle.png")
    pack_sheet(attack, OUT_CELL).save(
        ROOT / "assets" / "characters" / "anim" / "taeo-attack.png"
    )
    pack_sheet(roll_frames(idle[0], OUT_CELL, HERO_COL["taeo"]), OUT_CELL).save(
        ROOT / "assets" / "characters" / "anim" / "taeo-roll.png"
    )
    # Resting token: the cute-slot draw stretches its file to the token box, so
    # it needs a single tight square rather than the 6-frame sheet.
    bbox = idle[0].getbbox()
    sprite = idle[0].crop(bbox)
    side = max(sprite.size) + 12
    token = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    token.paste(
        sprite,
        ((side - sprite.width) // 2, (side - sprite.height) // 2),
        sprite,
    )
    token.save(ROOT / "assets" / "characters" / "cute" / "taeo-orc-token.png")
    print("taeo orc restyle written: idle x", len(idle), ", attack x", len(attack))


if __name__ == "__main__":
    main()
