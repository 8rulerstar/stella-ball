#!/usr/bin/env python3
"""Draw Luna's guide portrait, the locked achievement badge and the brand marks.

Outputs (all repo-relative, overwriting in place):
  assets/library/guide/luna-portrait.png       onboarding helper face, 64px
  assets/library/anim/guide/luna-idle.png      4-frame blink/twinkle sheet
  assets/library/event/achievement-locked.png  slate recolour of the unlocked
                                               badge with a padlock overlay
  assets/library/brand/favicon-32.png          gold star favicon
  assets/original/stella-ball-wordmark.svg     font-free pixel-rect wordmark
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]

INK = (13, 10, 31, 255)
DEEP = (30, 27, 66, 255)
ROBE = (59, 63, 125, 255)
ROBE_L = (86, 97, 181, 255)
MOON = (207, 216, 255, 255)
BLUE = (147, 165, 245, 255)
HAIR = (232, 227, 250, 255)
HAIR_M = (185, 174, 230, 255)
HAIR_D = (141, 127, 199, 255)
SKIN = (244, 223, 200, 255)
SKIN_S = (217, 183, 155, 255)
EYE = (32, 29, 61, 255)
WHITE = (255, 255, 255, 255)
GOLD = (242, 197, 107, 255)
GOLD_L = (255, 243, 196, 255)
BLUSH = (240, 172, 156, 255)


def px_scale(im: Image.Image, k: int) -> Image.Image:
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def star(d, cx, cy, col, core):
    d.line((cx - 2, cy, cx + 2, cy), fill=col)
    d.line((cx, cy - 2, cx, cy + 2), fill=col)
    d.point((cx, cy), fill=core)


def luna_base() -> Image.Image:
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((5, 2, 26, 25), fill=INK)
    d.ellipse((6, 3, 25, 24), fill=ROBE)
    d.ellipse((7, 4, 24, 21), fill=ROBE_L)
    d.ellipse((8, 5, 23, 22), fill=ROBE)
    d.polygon([(4, 31), (7, 22), (24, 22), (27, 31)], fill=INK)
    d.polygon([(5, 31), (8, 23), (23, 23), (26, 31)], fill=DEEP)
    d.rectangle((8, 23, 23, 24), fill=ROBE)
    d.rectangle((9, 25, 22, 25), fill=GOLD)
    d.point((9, 25), fill=GOLD_L)
    d.ellipse((9, 7, 22, 20), fill=INK)
    d.ellipse((10, 8, 21, 19), fill=SKIN)
    d.ellipse((9, 6, 22, 12), fill=HAIR)
    d.rectangle((10, 11, 12, 12), fill=HAIR_M)
    d.rectangle((14, 11, 15, 12), fill=HAIR_M)
    d.rectangle((18, 11, 20, 12), fill=HAIR_M)
    d.point((13, 12), fill=HAIR_D)
    d.point((17, 12), fill=HAIR_D)
    d.rectangle((9, 10, 10, 16), fill=HAIR_M)
    d.rectangle((21, 10, 22, 16), fill=HAIR_M)
    d.rectangle((12, 13, 13, 15), fill=EYE)
    d.rectangle((18, 13, 19, 15), fill=EYE)
    d.point((12, 13), fill=WHITE)
    d.point((18, 13), fill=WHITE)
    d.point((13, 15), fill=BLUE)
    d.point((19, 15), fill=BLUE)
    d.point((11, 16), fill=BLUSH)
    d.point((20, 16), fill=BLUSH)
    d.rectangle((15, 17, 16, 17), fill=SKIN_S)
    d.ellipse((8, 3, 13, 8), fill=GOLD)
    d.ellipse((10, 3, 14, 7), fill=ROBE)
    d.point((9, 4), fill=GOLD_L)
    star(d, 27, 4, GOLD, GOLD_L)
    return im


def luna_frames() -> list[Image.Image]:
    base = luna_base()
    blink = base.copy()
    d = ImageDraw.Draw(blink)
    d.rectangle((12, 13, 13, 15), fill=SKIN)
    d.rectangle((18, 13, 19, 15), fill=SKIN)
    d.rectangle((12, 14, 13, 14), fill=EYE)
    d.rectangle((18, 14, 19, 14), fill=EYE)
    twinkle = base.copy()
    d = ImageDraw.Draw(twinkle)
    d.line((24, 4, 30, 4), fill=GOLD)
    d.line((27, 1, 27, 7), fill=GOLD)
    d.point((27, 4), fill=WHITE)
    d.point((9, 4), fill=WHITE)
    bob = base.copy()
    d = ImageDraw.Draw(bob)
    d.point((26, 6), fill=MOON)
    d.point((25, 3), fill=MOON)
    return [base, blink, twinkle, bob]


def write_luna() -> None:
    frames = luna_frames()
    guide = ROOT / "assets" / "library" / "guide"
    anim = ROOT / "assets" / "library" / "anim" / "guide"
    guide.mkdir(parents=True, exist_ok=True)
    anim.mkdir(parents=True, exist_ok=True)
    px_scale(frames[0], 2).save(guide / "luna-portrait.png")
    sheet = Image.new("RGBA", (64 * 4, 64), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.paste(px_scale(frame, 2), (i * 64, 0))
    sheet.save(anim / "luna-idle.png")


def write_locked_badge() -> None:
    src = Image.open(ROOT / "assets" / "library" / "event" / "achievement-unlocked.png").convert("RGBA")
    w, h = src.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sp, op = src.load(), out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = sp[x, y]
            if a == 0:
                continue
            lum = (r + g + b) / 3
            if r > 180 and g > 140 and b < 160:
                if lum > 215:
                    op[x, y] = (154, 163, 205, a)
                elif lum > 165:
                    op[x, y] = (96, 104, 152, a)
                else:
                    op[x, y] = (66, 72, 112, a)
            elif lum > 200:
                op[x, y] = (120, 126, 168, a)
            else:
                op[x, y] = (r, g, b, a)
    cell = max(2, w // 26)
    d = ImageDraw.Draw(out)

    def cellrect(cx, cy, cw, ch, col):
        d.rectangle((cx * cell, cy * cell, (cx + cw) * cell - 1, (cy + ch) * cell - 1), fill=col)

    cx0, cy0 = 26 // 2 - 3, 26 // 2 - 4
    light = (154, 163, 205, 255)
    mid = (96, 104, 152, 255)
    dark = (18, 16, 38, 255)
    cellrect(cx0 + 1, cy0, 4, 1, mid)
    cellrect(cx0, cy0 + 1, 1, 2, mid)
    cellrect(cx0 + 5, cy0 + 1, 1, 2, mid)
    cellrect(cx0 + 1, cy0, 1, 1, light)
    cellrect(cx0 - 1, cy0 + 3, 8, 5, dark)
    cellrect(cx0, cy0 + 3, 6, 4, mid)
    cellrect(cx0, cy0 + 3, 6, 1, light)
    cellrect(cx0 + 2, cy0 + 4, 2, 1, dark)
    cellrect(cx0 + 2, cy0 + 5, 1, 2, dark)
    out.save(ROOT / "assets" / "library" / "event" / "achievement-locked.png")


def write_favicon() -> None:
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((1, 1, 30, 30), fill=(13, 10, 31, 255))
    d.ellipse((2, 2, 29, 29), fill=(23, 20, 45, 255))
    d.arc((4, 6, 27, 29), 200, 340, fill=(147, 165, 245, 255))
    cx, cy = 15, 14
    d.polygon([(cx, cy - 9), (cx + 3, cy), (cx, cy + 9), (cx - 3, cy)], fill=GOLD)
    d.polygon([(cx - 8, cy), (cx, cy - 3), (cx + 8, cy), (cx, cy + 3)], fill=GOLD)
    d.polygon([(cx, cy - 5), (cx + 2, cy), (cx, cy + 5), (cx - 2, cy)], fill=GOLD_L)
    d.point((cx, cy), fill=WHITE)
    d.point((24, 8), fill=(207, 216, 255, 255))
    d.point((7, 22), fill=(147, 165, 245, 255))
    d.point((25, 24), fill=GOLD_L)
    im.save(ROOT / "assets" / "library" / "brand" / "favicon-32.png")


F57 = {
    "S": ["01110", "10001", "10000", "01110", "00001", "10001", "01110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    " ": ["000", "000", "000", "000", "000", "000", "000"],
}
F35 = {
    "T": ["111", "010", "010", "010", "010"], "H": ["101", "101", "111", "101", "101"],
    "E": ["111", "100", "111", "100", "111"], "L": ["100", "100", "100", "100", "111"],
    "A": ["010", "101", "111", "101", "101"], "S": ["011", "100", "010", "001", "110"],
    "O": ["010", "101", "101", "101", "010"], "B": ["110", "101", "110", "101", "110"],
    "R": ["110", "101", "110", "110", "101"], "V": ["101", "101", "101", "101", "010"],
    "Y": ["101", "101", "010", "010", "010"], " ": ["00", "00", "00", "00", "00"],
}


def glyph_cells(text: str, font: dict) -> tuple[list, int]:
    cells = []
    col = 0
    for ch in text:
        glyph = font[ch]
        for row, bits in enumerate(glyph):
            for idx, bit in enumerate(bits):
                if bit == "1":
                    cells.append((col + idx, row))
        col += len(glyph[0]) + 1
    return cells, col - 1


def write_wordmark() -> None:
    cells, width_cells = glyph_cells("STELLA BALL", F57)
    cell = 10
    x0 = (720 - width_cells * cell) // 2
    y0 = 34
    filled = set(cells)
    outline = set()
    for cx, cy in cells:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                p = (cx + dx, cy + dy)
                if p not in filled:
                    outline.add(p)

    def band(row: int) -> str:
        if row <= 1:
            return "#fff6cf"
        if row <= 4:
            return "#f6d98c"
        return "#eab961"

    shadow = "".join(
        f'<rect x="{x0 + cx * cell}" y="{y0 + (cy + 1) * cell - 4}" width="{cell}" height="{cell}"/>'
        for cx, cy in sorted(filled))
    outline_rects = "".join(
        f'<rect x="{x0 + cx * cell}" y="{y0 + cy * cell}" width="{cell}" height="{cell}"/>'
        for cx, cy in sorted(outline))
    body: dict = {}
    for cx, cy in sorted(filled):
        body.setdefault(band(cy), []).append((cx, cy))
    body_groups = "".join(
        f'<g fill="{col}">' + "".join(
            f'<rect x="{x0 + cx * cell}" y="{y0 + cy * cell}" width="{cell}" height="{cell}"/>'
            for cx, cy in pts) + "</g>"
        for col, pts in body.items())
    sub_cells, sub_width = glyph_cells("THE LAST OBSERVATORY", F35)
    scell = 4
    sx0 = (720 - sub_width * scell) // 2
    sy0 = 136
    sub = "".join(
        f'<rect x="{sx0 + cx * scell}" y="{sy0 + cy * scell}" width="{scell}" height="{scell}"/>'
        for cx, cy in sorted(sub_cells))
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 180" role="img" aria-labelledby="title desc" shape-rendering="crispEdges">
  <title id="title">STELLA BALL</title>
  <desc id="desc">Stella Ball pixel wordmark in starlight gold and moonlight blue; no font dependency.</desc>
  <defs>
    <linearGradient id="orbit" x1="0" x2="1">
      <stop stop-color="#90a2ff" stop-opacity="0" offset="0"/>
      <stop stop-color="#dfe7ff" stop-opacity=".82" offset=".45"/>
      <stop stop-color="#f3cc78" stop-opacity="0" offset="1"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-30%" width="140%" height="170%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <path fill="none" stroke="url(#orbit)" stroke-width="2" d="M105 113C230 14 490 14 618 109"/>
  <path fill="none" stroke="#aebdff" stroke-opacity=".4" stroke-width="1" stroke-dasharray="3 9" d="M132 132C258 157 475 157 588 128"/>
  <path fill="#9daeff" d="m53 44 7 19 20 7-20 7-7 19-7-19-20-7 20-7zm592 21 5 13 13 5-13 5-5 13-5-13-13-5 13-5z" filter="url(#glow)"/>
  <g fill="#080b20" opacity=".9">{shadow}</g>
  <g fill="#080b20">{outline_rects}</g>
  {body_groups}
  <path fill="#b9c8ff" d="M166 123h388v5H166z"/>
  <circle cx="151" cy="125.5" r="3" fill="#f4d17c"/><circle cx="570" cy="125.5" r="3" fill="#f4d17c"/>
  <g fill="#b8c7ff">{sub}</g>
</svg>
'''
    (ROOT / "assets" / "original" / "stella-ball-wordmark.svg").write_text(svg, encoding="utf-8")


def main() -> None:
    write_luna()
    write_locked_badge()
    write_favicon()
    write_wordmark()
    print("guide and brand art written")


if __name__ == "__main__":
    main()
