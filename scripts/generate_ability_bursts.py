#!/usr/bin/env python3
"""Draw the 4-frame ability burst sheets played by drawAbilityFx.

Each sheet is keyed by ability kind in game-data's abilityFxSheets and packs
four 256px frames horizontally; the runtime treats any 4:1 texture as a sheet
and steps through it across the burst lifetime. Frames are drawn chunky at
64px and scaled with nearest-neighbour so they sit with the pixel art.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "library" / "anim" / "fx"
S = 64
INK = (13, 10, 31)
WHITE = (255, 255, 255)
GOLD = (255, 223, 128)

KINDS = {
    "slash": (242, 197, 107),
    "longshot": (239, 113, 141),
    "split": (112, 220, 225),
    "seek": (158, 228, 119),
    "turn": (188, 167, 255),
    "shockwave": (255, 172, 103),
    "copycat": (159, 131, 255),
}


def lighten(col, f):
    return tuple(int(c + (255 - c) * f) for c in col)


def darken(col, f):
    return tuple(int(c * (1 - f) + INK[i] * f) for i, c in enumerate(col))


def star(d, cx, cy, r, col, core=WHITE):
    d.line((cx - r, cy, cx + r, cy), fill=col, width=1)
    d.line((cx, cy - r, cx, cy + r), fill=col, width=1)
    if r > 2:
        d.point((cx - 1, cy - 1), fill=col)
        d.point((cx + 1, cy + 1), fill=col)
    d.point((cx, cy), fill=core)


def ring(d, cx, cy, r, col, w=2):
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=col, width=w)


def crescent(im, cx, cy, r, thick, a0, a1, col):
    ImageDraw.Draw(im).arc((cx - r, cy - r, cx + r, cy + r), a0, a1, fill=col, width=thick)


def outline_pass(im):
    src = im.load()
    base = im.copy()
    bp = base.load()
    for y in range(S):
        for x in range(S):
            if src[x, y][3] > 60:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                qx, qy = x + dx, y + dy
                if 0 <= qx < S and 0 <= qy < S and bp[qx, qy][3] > 60:
                    src[x, y] = INK + (255,)
                    break
    return im


def gen(kind, col):
    frames = []
    for i in range(4):
        q = i / 3
        im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        c = S // 2
        if kind == "slash":
            r = 20 + int(q * 8)
            sweep = 170 - int(q * 30)
            start = -80 + q * 140
            crescent(im, c, c, r, 9 - int(q * 3), start, start + sweep, col)
            crescent(im, c, c, r + 4, 3, start + 6, start + sweep - 6, lighten(col, 0.85))
            crescent(im, c, c, r - 5, 3, start + 16, start + sweep - 26, darken(col, 0.25))
            if i <= 1:
                crescent(im, c, c, r - 9, 2, start + 30, start + sweep - 40, lighten(col, 0.55))
            if i >= 2:
                for k in range(6):
                    a = math.radians(start + sweep - k * 26)
                    rr = r + 5 + (k % 3) * 3
                    star(d, int(c + math.cos(a) * rr), int(c + math.sin(a) * rr), 2 + (k % 2), GOLD if k % 2 else WHITE)
        elif kind == "longshot":
            y0 = c
            ln = 22 + int(q * 30)
            x0 = c - ln * 2 // 3
            tip = x0 + ln
            d.rectangle((x0, y0 - 2, tip, y0 + 2), fill=darken(col, 0.15))
            d.rectangle((x0 + 3, y0 - 1, tip, y0 + 1), fill=col)
            d.rectangle((x0 + ln // 2, y0, tip, y0), fill=lighten(col, 0.9))
            d.polygon([(tip + 8, y0), (tip - 3, y0 - 6), (tip - 3, y0 + 6)], fill=col)
            d.polygon([(tip + 5, y0), (tip - 1, y0 - 3), (tip - 1, y0 + 3)], fill=lighten(col, 0.8))
            for k in range(2):
                cx = x0 + 6 + k * 14
                d.line((cx, y0 - 6, cx - 6, y0), fill=darken(col, 0.2))
                d.line((cx - 6, y0, cx, y0 + 6), fill=darken(col, 0.2))
            d.line((x0 - 7, y0 - 4, x0 - 1, y0 - 4), fill=lighten(col, 0.4))
            d.line((x0 - 5, y0 + 4, x0 + 1, y0 + 4), fill=lighten(col, 0.4))
            if i >= 1:
                star(d, tip + 6, y0, 4 + i, WHITE, GOLD)
            if i >= 2:
                ring(d, tip + 5, y0, 5 + i * 3, lighten(col, 0.55), 1)
                star(d, x0 + 4, y0 - 8, 2, GOLD)
                star(d, x0 + 12, y0 + 8, 2, GOLD)
        elif kind == "split":
            off = int(q * 17)
            if i == 0:
                d.ellipse((c - 8, c - 8, c + 8, c + 8), fill=col)
                d.ellipse((c - 4, c - 5, c + 1, c), fill=lighten(col, 0.8))
                ring(d, c, c, 13, lighten(col, 0.5), 2)
                star(d, c, c, 3, WHITE)
            else:
                for sgn in (-1, 1):
                    cx = c + sgn * off
                    d.ellipse((cx - 7, c - 7, cx + 7, c + 7), fill=col)
                    d.ellipse((cx - 4, c - 5, cx + 1, c), fill=lighten(col, 0.8))
                    ring(d, cx, c, 10, lighten(col, 0.45), 1)
                for yy in (-2, 0, 2):
                    d.line((c - off + 7, c + yy, c + off - 7, c + yy), fill=lighten(col, 0.75 - abs(yy) * 0.12))
                star(d, c, c, 3 + i, WHITE, GOLD)
                if i >= 2:
                    star(d, c - off, c - 11, 2, WHITE)
                    star(d, c + off, c + 11, 2, WHITE)
                    star(d, c, c - 15, 2, GOLD)
        elif kind == "seek":
            ang = q * math.pi * 1.5 - math.pi / 2
            rr = 16
            hx, hy = c + math.cos(ang) * rr, c + math.sin(ang) * rr
            for t in range(14):
                ta = ang - t * 0.22
                tr = rr - t * 0.35
                px = int(c + math.cos(ta) * tr)
                py = int(c + math.sin(ta) * tr)
                w = max(1, 5 - t // 3)
                f = max(0.0, 1 - t / 14)
                d.ellipse((px - w, py - w, px + w, py + w), fill=darken(col, 0.4 - f * 0.4) + (int(70 + f * 185),))
            d.ellipse((hx - 6, hy - 6, hx + 6, hy + 6), fill=col)
            d.ellipse((hx - 3, hy - 4, hx + 1, hy), fill=lighten(col, 0.85))
            star(d, int(hx), int(hy), 2, WHITE)
            if i >= 1:
                ring(d, c, c, rr + 5, lighten(col, 0.25), 1)
            if i >= 2:
                star(d, int(hx) + 6, int(hy) - 6, 3, GOLD)
                star(d, int(c - math.cos(ang) * rr), int(c - math.sin(ang) * rr), 2, WHITE)
        elif kind == "turn":
            rot = 0 if i < 2 else math.pi / 2
            arm = 14 + (2 if i in (1, 2) else 0)

            def R(px, py):
                cs, sn = math.cos(rot), math.sin(rot)
                return (c + px * cs - py * sn, c + px * sn + py * cs)

            pts = [R(-arm, arm * 0.55), R(0, arm * 0.55), R(0, -arm * 0.45)]
            d.line([pts[0], pts[1], pts[2]], fill=col, width=4)
            hx, hy = R(0, -arm * 0.45 - 4)
            d.polygon([(hx, hy), R(-4, -arm * 0.45 + 2), R(4, -arm * 0.45 + 2)], fill=lighten(col, 0.5))
            if i in (1, 2):
                ring(d, c, c, 18, lighten(col, 0.45), 1)
            if i == 3:
                for k in range(4):
                    a = k * math.pi / 2 + 0.6
                    star(d, int(c + math.cos(a) * 13), int(c + math.sin(a) * 13), 2, GOLD)
        elif kind == "shockwave":
            r = 5 + int(q * 22)
            ring(d, c, c, r, col, 3)
            if i >= 1:
                ring(d, c, c, max(3, r - 7), lighten(col, 0.6), 1)
            for k in range(8):
                a = k * math.pi / 4 + 0.3
                rx = int(c + math.cos(a) * (r + 3))
                ry = int(c + math.sin(a) * (r + 3))
                sz = 2 if k % 2 else 3
                d.rectangle((rx, ry, rx + sz, ry + sz), fill=darken(col, 0.35))
            if i == 0:
                d.ellipse((c - 4, c - 4, c + 4, c + 4), fill=lighten(col, 0.8))
            if i >= 2:
                for k in range(4):
                    a = k * math.pi / 2 + 0.9
                    star(d, int(c + math.cos(a) * (r - 4)), int(c + math.sin(a) * (r - 4)), 2, GOLD)
        elif kind == "copycat":
            n = 1 + min(2, i)
            for k in range(n):
                half = 9 + k * 6 + int(q * 4)
                d.polygon([(c, c - half), (c + half, c), (c, c + half), (c - half, c)],
                          outline=(lighten(col, 0.6) if k == n - 1 else col))
            if i >= 1:
                star(d, c, c, 3, lighten(col, 0.85))
            if i >= 2:
                star(d, c + 13, c - 13, 2, GOLD)
                star(d, c - 13, c + 13, 2, GOLD)
            if i == 3:
                ring(d, c, c, 22, darken(col, 0.2), 1)
        frames.append(outline_pass(im))
    sheet = Image.new("RGBA", (256 * 4, 256), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.paste(frame.resize((256, 256), Image.NEAREST), (i * 256, 0))
    return sheet


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for kind, col in KINDS.items():
        gen(kind, col).save(OUT / f"fx-{kind}-burst.png")
    print("burst sheets written:", ", ".join(KINDS))


if __name__ == "__main__":
    main()
