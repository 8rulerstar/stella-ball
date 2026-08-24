"""이펙트 시트가 «서로 구분되는가»를 잰다 — 색을 빼고 형태만 본다.

2026-08-24 에 별지기 전용 시트 24장을 반입한 뒤 오너가 「가온 이펙트가 똑같은
것 같다」고 지적했다. 배선은 정상이었고 원인은 형태였다: 새 8장의 실루엣 겹침
중앙값이 대체한 7장보다 두 배 넘게 높았다(0.15 -> 0.34).

색으로 재면 안 된다. 여덟 별지기는 이미 고유색으로 갈려 있고, 그중 달무리
(#bca7ff)와 그믐(#9f83ff)은 hue 0.8도 차이라 색이 아예 못 가른다. 그래서 알파
실루엣만 논리 해상도(24x24)로 뽑아 쌍마다 IoU 를 낸다.

읽는 법:
  IoU 0.45 이상  두 시트가 판에서 구분되지 않는다
  0.33 ~ 0.45    애매하다
  0.15 근처      예전 per-kind 세트가 실제로 달성했던 수준 = 목표

  python scripts/measure_fx_distinctness.py            # 별지기 시전 8장
  python scripts/measure_fx_distinctness.py --awaken   # 각성 8장
  python scripts/measure_fx_distinctness.py --legacy   # 예전 per-kind 7장 (기준선)
  python scripts/measure_fx_distinctness.py a.png b.png ...
"""

import sys
from itertools import combinations
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FX = ROOT / "assets" / "library" / "anim" / "fx"
GRID = 24  # 논리 해상도. 시트는 192px 프레임 / 8px 셀이다.
ALPHA = 60

CAST = {
    "샛별": "gaon-swordwave.png",
    "미리내": "biyeon-arrow.png",
    "별하": "lumi-split.png",
    "살별": "haru-dash.png",
    "윤슬": "ria-bladewheel.png",
    "달무리": "sera-orbit.png",
    "모루": "taeo-shockwave.png",
    "그믐": "nyx-copy.png",
}
AWAKEN = {
    name: file.split("-")[0] + "-awaken.png" for name, file in CAST.items()
}
LEGACY = {
    kind: f"fx-{kind}-burst.png"
    for kind in (
        "slash",
        "longshot",
        "split",
        "seek",
        "turn",
        "shockwave",
        "copycat",
    )
}


def silhouette(path):
    """네 프레임을 «합친» 실루엣. 이펙트는 한 프레임이 아니라 동작 전체다.

    처음에는 가장 꽉 찬 프레임 하나만 봤는데, 각성 시트에서 그 방법이 틀린
    답을 냈다 — 여덟이 공유하는 «고리»가 그 프레임의 픽셀 대부분이라 IoU 가
    0.78 로 나왔고, 정작 갈리는 2·3프레임의 솟는 표식(검·활·혜성·칼날바퀴·
    모루·구슬)이 묻혔다. 하마터면 멀쩡한 시트를 결함으로 보고할 뻔했다.
    """
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    frame_width = width // 4
    cells = GRID * GRID
    merged = [0] * cells
    for index in range(4):
        frame = image.crop(
            (index * frame_width, 0, (index + 1) * frame_width, height)
        ).resize((GRID, GRID), Image.NEAREST)
        for i, pixel in enumerate(frame.getdata()):
            if pixel[3] > ALPHA:
                merged[i] = 1
    return merged


def report(sheets, label):
    masks = {}
    for name, path in sheets.items():
        resolved = Path(path)
        if not resolved.is_absolute():
            resolved = FX / path
        if not resolved.exists():
            print(f"  없는 파일: {resolved}")
            return 1
        masks[name] = silhouette(resolved)

    cells = GRID * GRID
    """세트 «전부»에 공통인 칸은 빼고 잰다. 그것은 그 세트의 어휘(각성 인장의
       고리 같은 것)이지 구분을 방해하는 것이 아니다. 남는 것이 표식이다."""
    shared = [
        1 if all(masks[name][i] for name in masks) else 0 for i in range(cells)
    ]
    shared_count = sum(shared)

    def pairs_for(drop_shared):
        found = []
        for left, right in combinations(masks, 2):
            a, b = masks[left], masks[right]
            intersection = union = 0
            for i in range(cells):
                if drop_shared and shared[i]:
                    continue
                if a[i] and b[i]:
                    intersection += 1
                if a[i] or b[i]:
                    union += 1
            found.append(((intersection / union) if union else 0.0, left, right))
        found.sort(reverse=True)
        return found

    raw = pairs_for(False)
    pairs = pairs_for(True)
    values = sorted(value for value, _, _ in pairs)
    median = values[len(values) // 2]
    over = [p for p in pairs if p[0] >= 0.45]
    raw_median = sorted(v for v, _, _ in raw)[len(raw) // 2]

    print(f"\n{label} — 시트 {len(masks)}장 · 쌍 {len(pairs)}개")
    print(f"  공유 어휘: {shared_count}/{cells}칸 ({shared_count / cells * 100:.0f}%)"
          f" · 그것을 포함한 중앙 IoU {raw_median:.2f}")
    print(f"  중앙 IoU {median:.2f} · 최악 {pairs[0][0]:.2f} "
          f"({pairs[0][1]}↔{pairs[0][2]}) · 0.45 이상 {len(over)}쌍")
    print("  겹치는 쪽부터:")
    for value, left, right in pairs[:8]:
        mark = " <- 구분 안 됨" if value >= 0.45 else (" <- 애매" if value >= 0.33 else "")
        print(f"    {left:<5} {right:<5} {value:.2f}{mark}")
    print("  채워진 칸(576 중):")
    for name in masks:
        print(f"    {name:<5} {sum(masks[name]):>3}")
    return 0


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    if args:
        return report({Path(a).stem: a for a in args}, "지정한 시트")
    if "--awaken" in flags:
        return report(AWAKEN, "별지기 각성 시트")
    if "--legacy" in flags:
        return report(LEGACY, "예전 per-kind 시트 (기준선)")
    return report(CAST, "별지기 시전 시트")


if __name__ == "__main__":
    raise SystemExit(main())
