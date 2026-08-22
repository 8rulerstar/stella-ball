"""기믹 범례 아이콘 여덟 장을 굽는다.

왜 스크립트인가: VISUAL_UPGRADE_2026_08_22.md §8-1(목표 픽셀 스케일)이 아직
열려 있다. 손으로 찍어 두면 그 결정이 바뀔 때 여덟 장을 다시 그려야 하지만,
여기서 굽으면 CELL 한 줄만 고쳐 다시 돌리면 된다 — 요구서가 경고한
「두 번 찍는다」를 구조로 막는다.

격자: 논리 8x8, 셀 2px → 16x16 PNG. 출고된 도트 킷의 CELL=2 와 같다
(prototypes/stella-ball-dot-gimmicks.js:16). 판이 0.54~0.99배로 줄어드는
것은 판 위 모든 그림에 똑같이 걸리는 문제라 여기서 풀지 않는다.

색: 킷과 범례가 이미 쓰는 값을 그대로 쓴다. 가족마다 한 색을 유지해야
「범례의 그림 = 판 위의 그림」이라는 설계 근거가 성립한다.

  . 투명   o 외곽선   b 본색   h 하이라이트   d 어두운 면

    python scripts/generate_dot_icons.py
"""

from pathlib import Path
from PIL import Image

CELL = 2  # 판 위 셀. 도트 킷과 같아야 한다.
LOGICAL = 8
OUT = Path("assets/library/icons/gimmick")

# 가족별 색 — b(본색), h(하이라이트), d(그늘), o(외곽선)
PALETTE = {
    "wall": ("#9dc2cf", "#eafaf4", "#5c8592", "#0e2028"),
    "boost": ("#b9ef86", "#f2ffe0", "#6f9c4e", "#12240e"),
    "drag": ("#b39ddb", "#e6dcff", "#6f5f92", "#1a1230"),
    "add": ("#c86bd8", "#f0c8f8", "#7a3a85", "#1f0a24"),
    "orbit": ("#7cc6bb", "#d8f2ea", "#3f7a72", "#0e2028"),
    "shield": ("#9adfc9", "#eafaf4", "#4d8a78", "#0e2028"),
    "roar": ("#ffd2a0", "#fff3c9", "#a06a3a", "#2a1408"),
    "sleep": ("#8fa8d8", "#dbe6ff", "#4f5f85", "#101828"),
}

# 8x8 도안. 읽기 쉬우라고 글자로 적는다 — 이 파일이 곧 원화다.
ART = {
    # 반사 벽 — 판 셋이 이어지고 갈매기가 흐른다
    "wall": [
        "........",
        "oooooooo",
        "ohbhbhbo",
        "obdbdbdo",
        "oh.b.b.o",
        "obdbdbdo",
        "oooooooo",
        "........",
    ],
    # 가속 발판 — 위로 겹치는 갈매기 둘
    "boost": [
        "...hh...",
        "..hbbh..",
        ".hb..bh.",
        "ho....oh",
        "...hh...",
        "..hbbh..",
        ".ob..bo.",
        "o......o",
    ],
    # 흐린 여울 — 아래로 흐려지는 가로줄 셋
    "drag": [
        "ohhhhhho",
        "obbbbbbo",
        "........",
        ".obbbbo.",
        ".oddddo.",
        "........",
        "..oddo..",
        "..o..o..",
    ],
    # 눈이 붙어 바이저로 읽혔다 — 몸통 두 칸을 사이에 두어 얼굴로 읽히게 한다.
    "add": [
        "..hhhh..",
        ".hbbbbh.",
        "hbobbobh",
        "hbbbbbbh",
        "hbbbbbbh",
        ".dbbbbd.",
        "..d..d..",
        ".o.oo.o.",
    ],
    # 보루가 T자로 읽혔다 — 궤도를 점 여덟으로 두르고 보루만 2x2 덩어리로.
    "orbit": [
        "..d..d..",
        ".d....d.",
        "d......h",
        ".......h",
        "d.....hh",
        ".......h",
        ".d....d.",
        "..d..d..",
    ],
    # 산 모양으로 읽혔다 — 판 위 껍질이 «틈 있는 고리»이므로 그대로 옮긴다.
    "shield": [
        "..bb.b..",
        ".b....b.",
        "b......b",
        "b.......",
        "b.......",
        "b......b",
        ".b....b.",
        "..b.bb..",
    ],
    # 포효 — 바깥으로 튀는 화살 넷
    "roar": [
        "o..hh..o",
        ".h.bb.h.",
        "..obbo..",
        "hbb..bbh",
        "hbb..bbh",
        "..obbo..",
        ".h.bb.h.",
        "o..dd..o",
    ],
    # 재수면 — 감긴 눈
    "sleep": [
        "........",
        "..hhhh..",
        ".h....h.",
        "h......h",
        "obbbbbbo",
        "..o..o..",
        ".o....o.",
        "........",
    ],
}


def bake(name: str) -> Image.Image:
    b, h, d, o = PALETTE[name]
    lut = {"o": o, "b": b, "h": h, "d": d}
    img = Image.new("RGBA", (LOGICAL * CELL, LOGICAL * CELL), (0, 0, 0, 0))
    px = img.load()
    for row, line in enumerate(ART[name]):
        assert len(line) == LOGICAL, f"{name} {row}행이 {len(line)}칸"
        for col, ch in enumerate(line):
            if ch == ".":
                continue
            hexv = lut[ch]
            rgb = tuple(int(hexv[i : i + 2], 16) for i in (1, 3, 5)) + (255,)
            for dy in range(CELL):
                for dx in range(CELL):
                    px[col * CELL + dx, row * CELL + dy] = rgb
    return img


def main() -> None:
    assert len(ART) == len(PALETTE) == 8, "여덟 가족이어야 한다"
    OUT.mkdir(parents=True, exist_ok=True)
    for name in ART:
        img = bake(name)
        path = OUT / f"{name}.png"
        img.save(path)
        print(f"  {path}  {img.size[0]}x{img.size[1]}")
    print(f"셀 {CELL}px · 논리 {LOGICAL}x{LOGICAL} · 여덟 장")


if __name__ == "__main__":
    main()
