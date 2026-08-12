#!/usr/bin/env python3
"""Build the per-hero attack and roll sheets used by the combat animState.

Every roster hero is a pure palette swap of a Tiny Swords source sheet, so a
positional colour LUT learned from the idle pair transplants the hero palette
onto the source pack's real action frames at original quality. Rolls are the
idle pose tumbling in lossless 90-degree steps around its own centroid.

The Tiny Swords packs are not part of the repository. Point TS_ASSETS_DIR at
the folder that contains "Tiny Swords (Free Pack)" and "Tiny Swords (Enemy
Pack)"; without the variable the script tries D:/Assets and ~/Assets.

Usage:
  python scripts/generate_unit_action_sheets.py          # write all sheets
  python scripts/generate_unit_action_sheets.py --check  # verify bases only
"""

from __future__ import annotations

import math
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "characters" / "anim"
FACTIONS = ["Blue", "Purple", "Red", "Black", "Yellow"]

# id: (idle sheet, cell, per-faction source unit, attack source, frame picks)
HEROES = {
    "gaon": ("gaon-warrior-idle.png", 192, "Warrior/Warrior_Idle.png", "Warrior/Warrior_Attack1.png", [0, 1, 2, 3]),
    "nyx": ("nyx-oracle-idle.png", 192, "Warrior/Warrior_Idle.png", "Warrior/Warrior_Attack2.png", [0, 1, 2, 3]),
    "biyeon": ("biyeon-archer-idle.png", 192, "Archer/Archer_Idle.png", "Archer/Archer_Shoot.png", [1, 3, 5, 6]),
    "sera": ("sera-monk-idle.png", 192, "Monk/Idle.png", "Monk/Heal.png", [1, 4, 7, 9]),
    # taeo moved to the Tiny RPG orc base: generate_taeo_orc_restyle.py owns
    # his idle/roll/attack sheets now, so he must not be regenerated here.
    "haru": ("haru-lancer-idle.png", 320, "Lancer/Lancer_Idle.png", "Lancer/Lancer_Right_Attack.png", [0, 0, 1, 2]),
    "lumi": ("lumi-shaman-idle.png", 192, None, None, [1, 4, 6, 8]),
}
# lumi was recoloured from the Enemy Pack's Hex Shaman rather than a faction unit.
LUMI_IDLE = "Enemies/Goblin Raiders/Hex Shaman/Hex Shaman_Idle.png"
LUMI_ATTACK = "Enemies/Goblin Raiders/Hex Shaman/Hex Shaman_Attack.png"

HERO_COL = {
    "gaon": (242, 197, 107), "biyeon": (239, 113, 141), "lumi": (112, 220, 225),
    "haru": (158, 228, 119), "sera": (188, 167, 255), "taeo": (255, 172, 103),
    "nyx": (159, 131, 255), "ria": (95, 224, 207),
}


def pack_root() -> Path:
    candidates = []
    if os.environ.get("TS_ASSETS_DIR"):
        candidates.append(Path(os.environ["TS_ASSETS_DIR"]))
    candidates += [Path("D:/Assets"), Path.home() / "Assets"]
    for cand in candidates:
        if (cand / "Tiny Swords (Free Pack)").exists():
            return cand
    raise SystemExit(
        "Tiny Swords packs not found. Set TS_ASSETS_DIR to the folder that "
        "contains 'Tiny Swords (Free Pack)' and 'Tiny Swords (Enemy Pack)'."
    )


def frames_of(img: Image.Image, cell: int) -> list[Image.Image]:
    return [img.crop((i * cell, 0, (i + 1) * cell, img.height)) for i in range(img.width // cell)]


def mask_iou(a: Image.Image, b: Image.Image) -> float:
    am = a.getchannel("A").point(lambda v: 1 if v > 40 else 0)
    bm = b.getchannel("A").point(lambda v: 1 if v > 40 else 0)
    inter = union = 0
    for pa, pb in zip(am.getdata(), bm.getdata()):
        if pa or pb:
            union += 1
            if pa and pb:
                inter += 1
    return inter / union if union else 0.0


def learn_lut(hero: Image.Image, source: Image.Image) -> tuple[dict, float]:
    hp, sp = hero.load(), source.load()
    votes: dict = defaultdict(Counter)
    total = agree = 0
    for y in range(hero.height):
        for x in range(hero.width):
            hpx, spx = hp[x, y], sp[x, y]
            if hpx[3] > 40 and spx[3] > 40:
                votes[spx[:3]][hpx[:3]] += 1
                total += 1
    lut = {}
    for src, counter in votes.items():
        dst, n = counter.most_common(1)[0]
        lut[src] = dst
        agree += n
    return lut, (agree / total if total else 0.0)


def apply_lut(img: Image.Image, lut: dict) -> Image.Image:
    out = img.copy()
    px = out.load()
    keys = list(lut.keys())
    cache: dict = {}
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a <= 0:
                continue
            src = (r, g, b)
            if src in lut:
                px[x, y] = lut[src] + (a,)
                continue
            if src not in cache:
                best, dist = None, 1 << 30
                for key in keys:
                    d = (key[0] - r) ** 2 + (key[1] - g) ** 2 + (key[2] - b) ** 2
                    if d < dist:
                        dist, best = d, key
                cache[src] = lut[best] if best is not None and dist <= 3600 else src
            px[x, y] = cache[src] + (a,)
    return out


def sprite_centroid(im: Image.Image) -> tuple[float, float]:
    alpha = im.getchannel("A").load()
    sx = sy = n = 0
    for y in range(im.height):
        for x in range(im.width):
            if alpha[x, y] > 40:
                sx += x
                sy += y
                n += 1
    return (sx / n, sy / n) if n else (im.width / 2, im.height / 2)


def roll_frames(idle0: Image.Image, cell: int, col: tuple) -> list[Image.Image]:
    bbox = idle0.getbbox()
    sprite = idle0.crop(bbox)
    side = max(sprite.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(sprite, ((side - sprite.width) // 2, (side - sprite.height) // 2))
    cx, cy = sprite_centroid(idle0)
    frames = []
    for i, rot in enumerate([None, Image.ROTATE_270, Image.ROTATE_180, Image.ROTATE_90]):
        turned = square if rot is None else square.transpose(rot)
        frame = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
        frame.paste(turned, (int(cx - side / 2), int(cy - side / 2)), turned)
        px = frame.load()
        sparks = [
            (int(cx) - side // 2 - 4, int(cy) + (6 if i % 2 else -6)),
            (int(cx) + side // 2 + 3, int(cy) + (-8 if i % 2 else 8)),
        ]
        for sx, sy in sparks:
            for dx, dy in ((0, 0), (1, 0), (0, 1)):
                qx, qy = sx + dx, sy + dy
                if 0 <= qx < cell and 0 <= qy < cell:
                    px[qx, qy] = (255, 244, 210, 235) if i % 2 else col + (225,)
        frames.append(frame)
    return frames


def pack_sheet(frames: list[Image.Image], cell: int) -> Image.Image:
    sheet = Image.new("RGBA", (cell * len(frames), cell), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * cell, 0))
    return sheet


def build_ria(check_only: bool) -> None:
    # Ria has no Tiny Swords source: her single-frame idle is the base.  The
    # roll is the shared tumble; the attack is a blade flurry drawn over her
    # own pose, matching the chunky pixel density of the fx burst sheets.
    cell = 256
    idle = Image.open(ROOT / "assets" / "characters" / "ria-bladewheel-idle.png").convert("RGBA")
    frames = idle.width // cell
    print(f"ria     base=self       frames={frames} cell={cell}")
    if frames != 1:
        raise SystemExit("ria idle is expected to be a single 256px frame")
    if check_only:
        return
    col = HERO_COL["ria"]
    pack_sheet(roll_frames(idle.crop((0, 0, cell, cell)), cell, col), cell).save(OUT / "ria-roll.png")

    def overlay(draw_fn) -> Image.Image:
        art = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        draw_fn(ImageDraw.Draw(art))
        return art.resize((cell, cell), Image.NEAREST)

    def blades(d, r0, r1, width, sweep=52):
        for angle in (35, 215):
            d.arc((32 - r1, 32 - r1, 32 + r1, 32 + r1), angle, angle + sweep, fill=(255, 255, 255, 235), width=width)
        for angle in (125, 305):
            d.arc((32 - r0, 32 - r0, 32 + r0, 32 + r0), angle, angle + sweep, fill=col + (235,), width=width)

    def sparks(d, radius, count=4):
        for i in range(count):
            a = i * 6.283 / count + 0.7
            sx = int(32 + math.cos(a) * radius)
            sy = int(32 + math.sin(a) * radius)
            d.line((sx - 2, sy, sx + 2, sy), fill=(255, 223, 128, 240))
            d.line((sx, sy - 2, sx, sy + 2), fill=(255, 223, 128, 240))
            d.point((sx, sy), fill=(255, 255, 255, 255))

    base = idle.crop((0, 0, cell, cell))
    flash = base.copy()
    tint = Image.new("RGBA", (cell, cell), (235, 255, 252, 0))
    tint.putalpha(base.getchannel("A").point(lambda v: 210 if v > 40 else 0))
    flash.alpha_composite(tint)
    attack = []
    for i in range(4):
        frame = (flash if i == 1 else base).copy()
        if i == 0:
            frame.alpha_composite(overlay(lambda d: blades(d, 17, 20, 2, 34)))
        elif i == 1:
            frame.alpha_composite(overlay(lambda d: (blades(d, 21, 26, 4, 74), sparks(d, 27, 4))))
        elif i == 2:
            frame.alpha_composite(overlay(lambda d: (blades(d, 24, 29, 3, 58), sparks(d, 30, 6))))
        else:
            frame.alpha_composite(overlay(lambda d: sparks(d, 26, 4)))
        attack.append(frame)
    pack_sheet(attack, cell).save(OUT / "ria-attack.png")


def main() -> None:
    check_only = "--check" in sys.argv
    packs = pack_root()
    free = packs / "Tiny Swords (Free Pack)"
    enemy = packs / "Tiny Swords (Enemy Pack)" / "Enemy Pack"
    OUT.mkdir(parents=True, exist_ok=True)
    build_ria(check_only)
    failures = 0
    for hid, (idle_rel, cell, unit_rel, attack_rel, picks) in HEROES.items():
        hero = Image.open(ROOT / "assets" / "characters" / idle_rel).convert("RGBA")
        if hid == "lumi":
            source = Image.open(enemy / LUMI_IDLE).convert("RGBA")
            attack_src = Image.open(enemy / LUMI_ATTACK).convert("RGBA")
            lut, score = learn_lut(hero, source)
            label = "HexShaman"
        else:
            best = None
            for faction in FACTIONS:
                source = Image.open(free / f"Units/{faction} Units" / unit_rel).convert("RGBA")
                lut_f, score_f = learn_lut(hero, source)
                if best is None or score_f > best[1]:
                    best = (lut_f, score_f, faction, source)
            lut, score, label, source = best
            attack_src = Image.open(free / f"Units/{label} Units" / attack_rel).convert("RGBA")
        iou = mask_iou(frames_of(hero, cell)[0], frames_of(source, cell)[0])
        print(f"{hid:7s} base={label:10s} mask-iou={iou:.3f} lut-consistency={score:.3f}")
        if iou < 0.999 or score < 0.995:
            failures += 1
        if check_only:
            continue
        attack_frames = frames_of(attack_src, cell)
        attack = [apply_lut(attack_frames[min(i, len(attack_frames) - 1)], lut) for i in picks]
        pack_sheet(attack, cell).save(OUT / f"{hid}-attack.png")
        roll = roll_frames(frames_of(hero, cell)[0], cell, HERO_COL[hid])
        pack_sheet(roll, cell).save(OUT / f"{hid}-roll.png")
    if failures:
        raise SystemExit(f"{failures} hero(es) no longer match their source sheets")
    if not check_only:
        print(f"sheets written to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
