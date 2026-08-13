// 별자리 실루엣 6·7점 절차 생성 — orion.png / bigdipper.png
//
// 사양: FIGURE_ART_SPEC_6_7.md, 좌표 규약: ASSET_PLAN.md 「별자리 실루엣 규약」
//   384 × 384, 배경 투명, 128 그리드에 그린 뒤 ×3
//   뼈대 원점 = 이미지 정중앙, 뼈대 1단위 = 46 그리드칸 = 138px
//   game-figure.js 의 FIGURE_ART_SIZE(384) · FIGURE_ART_UNIT(46*3) 과 반드시 일치
//
// 실행: node scripts/generate_constellation_art_6_7.mjs
// 외부 의존성 없음 (node:zlib 로 PNG 직접 인코딩).
// 기존 5종을 덮어쓰지 않는다 — 이 스크립트는 6·7점 두 장만 쓴다.

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const GRID = 128,
  SCALE = 3,
  SIZE = GRID * SCALE,
  CENTER = GRID / 2,
  UNIT = 46;

// 뼈대 단위 좌표 → 그리드칸.  game-figure.js FIGURE_SHAPES[6|7].points 와 동일한 값.
const at = (x, y) => [CENTER + x * UNIT, CENTER + y * UNIT];

const ORION = {
  betelgeuse: at(-0.539, -0.717),
  bellatrix: at(0.225, -0.61),
  alnitak: at(-0.173, 0.233),
  alnilam: at(-0.057, 0.158),
  mintaka: at(0.05, 0.066),
  rigel: at(0.494, 0.87),
};
const DIPPER = {
  dubhe: at(0.778, -0.445),
  merak: at(0.797, -0.058),
  phecda: at(0.267, 0.136),
  megrez: at(0.047, -0.105),
  alioth: at(-0.346, -0.027),
  mizar: at(-0.651, 0.047),
  alkaid: at(-0.892, 0.452),
};

// 대상 고유색.  기존 5종과 같은 방침 — 재질이 색을 정한다.
// 오리온: 청동 + 가죽.  북두칠성: 주석 금속 + 그릇 안에 담긴 별빛.
const PAL = {
  bronze: ["#ffd79a", "#d99a52", "#93601f"],
  leather: ["#c1875a", "#8d5f3a", "#57381f"],
  cloth: ["#9c7049", "#785032", "#472a17"],
  skin: ["#f8e2ba", "#e2bd8a", "#a97f52"],
  tin: ["#f4faff", "#b9c6d6", "#6b7889"],
  tinRim: ["#ffffff", "#e8f1f9", "#a8b8c8"],
  glow: ["#fffdf6", "#fff1cf", "#ffdca0"],
};
const BELT_CORE = "#fff2d2",
  BELT_STUD = "#ffd9a0",
  STAR_MARK = "#ffeccb";
const SAIPH_ALPHA = 120; // 뼈대에 없는 별. 암시만 — 같은 톤을 반투명으로.

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

/* ── 그리드 마스크 프리미티브 ─────────────────────────────── */
const newMask = () => new Uint8Array(GRID * GRID);
const inGrid = (x, y) => x >= 0 && y >= 0 && x < GRID && y < GRID;
const mGet = (m, x, y) => (inGrid(x, y) ? m[y * GRID + x] : 0);
const mSet = (m, x, y) => {
  if (inGrid(x, y)) m[y * GRID + x] = 1;
};
const mClear = (m, x, y) => {
  if (inGrid(x, y)) m[y * GRID + x] = 0;
};

function disc(m, cx, cy, r, erase = false) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r) - 1; y <= cy + r + 1; y++)
    for (let x = Math.floor(cx - r) - 1; x <= cx + r + 1; x++) {
      const dx = x + 0.5 - cx,
        dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) (erase ? mClear : mSet)(m, x, y);
    }
}

function capsule(m, [ax, ay], [bx, by], r, erase = false) {
  const dx = bx - ax,
    dy = by - ay,
    len2 = dx * dx + dy * dy || 1,
    r2 = r * r;
  const x0 = Math.floor(Math.min(ax, bx) - r) - 1,
    x1 = Math.ceil(Math.max(ax, bx) + r) + 1,
    y0 = Math.floor(Math.min(ay, by) - r) - 1,
    y1 = Math.ceil(Math.max(ay, by) + r) + 1;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax,
        py = y + 0.5 - ay;
      let t = (px * dx + py * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = px - dx * t,
        ey = py - dy * t;
      if (ex * ex + ey * ey <= r2) (erase ? mClear : mSet)(m, x, y);
    }
}

function path(m, pts, r, erase = false) {
  for (let i = 1; i < pts.length; i++) capsule(m, pts[i - 1], pts[i], r, erase);
}

// 굵기가 변하는 폴리라인.  팔다리는 뿌리가 굵고 끝이 가늘어야 인체로 읽힌다.
function taper(m, pts, r0, r1) {
  let total = 0;
  for (let i = 1; i < pts.length; i++)
    total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let run = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const steps = Math.max(2, Math.ceil(seg));
    for (let s = 0; s <= steps; s++) {
      const t = (run + (seg * s) / steps) / (total || 1);
      const p = lerp(pts[i - 1], pts[i], s / steps);
      disc(m, p[0], p[1], r0 + (r1 - r0) * t);
    }
    run += seg;
  }
}

function poly(m, pts, erase = false) {
  let minY = Infinity,
    maxY = -Infinity,
    minX = Infinity,
    maxX = -Infinity;
  for (const [px, py] of pts) {
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
  }
  for (let y = Math.floor(minY); y <= maxY; y++)
    for (let x = Math.floor(minX); x <= maxX; x++) {
      const cx = x + 0.5,
        cy = y + 0.5;
      let hit = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i],
          [xj, yj] = pts[j];
        if (
          yi > cy !== yj > cy &&
          cx < ((xj - xi) * (cy - yi)) / (yj - yi) + xi
        )
          hit = !hit;
      }
      if (hit) (erase ? mClear : mSet)(m, x, y);
    }
}

const centroid = (pts) => [
  pts.reduce((s, p) => s + p[0], 0) / pts.length,
  pts.reduce((s, p) => s + p[1], 0) / pts.length,
];
const scaleAbout = (pts, k, c = centroid(pts)) =>
  pts.map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const push = (p, from, d) => {
  const dx = p[0] - from[0],
    dy = p[1] - from[1],
    L = Math.hypot(dx, dy) || 1;
  return [p[0] + (dx / L) * d, p[1] + (dy / L) * d];
};

/* ── 색 입히기 ─────────────────────────────────────────────
   좌상단 테두리는 밝은 톤, 우하단 테두리는 어두운 톤, 안쪽은 기본 톤.
   기존 5종과 같은 3톤 픽셀 셰이딩이고, 도트 단위로만 판정한다. */
function shade(buf, mask, palette, alpha = 255) {
  const [lightC, baseC, darkC] = palette.map(hex);
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      if (!mask[y * GRID + x]) continue;
      const rimLight =
        !mGet(mask, x - 1, y) ||
        !mGet(mask, x, y - 1) ||
        !mGet(mask, x - 1, y - 1);
      const rimDark =
        !mGet(mask, x + 1, y) ||
        !mGet(mask, x, y + 1) ||
        !mGet(mask, x + 1, y + 1);
      put(buf, x, y, rimLight ? lightC : rimDark ? darkC : baseC, alpha);
    }
}

// 마스크를 안쪽 깊이로 나눠 칠한다.  그릇에 담긴 별빛처럼 중심이 밝은 것에 쓴다.
function shadeDepth(buf, mask, palette, alpha = 255) {
  const [coreC, midC, edgeC] = palette.map(hex);
  const depth = new Int16Array(GRID * GRID).fill(-1);
  let frontier = [];
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      if (!mask[y * GRID + x]) continue;
      if (
        !mGet(mask, x - 1, y) ||
        !mGet(mask, x + 1, y) ||
        !mGet(mask, x, y - 1) ||
        !mGet(mask, x, y + 1)
      ) {
        depth[y * GRID + x] = 0;
        frontier.push([x, y]);
      }
    }
  while (frontier.length) {
    const next = [];
    for (const [x, y] of frontier) {
      const d = depth[y * GRID + x];
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ])
        if (
          inGrid(nx, ny) &&
          mask[ny * GRID + nx] &&
          depth[ny * GRID + nx] < 0
        ) {
          depth[ny * GRID + nx] = d + 1;
          next.push([nx, ny]);
        }
    }
    frontier = next;
  }
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      if (!mask[y * GRID + x]) continue;
      const d = depth[y * GRID + x];
      put(buf, x, y, d >= 5 ? coreC : d >= 2 ? midC : edgeC, alpha);
    }
}

function put(buf, x, y, rgb, alpha = 255) {
  if (!inGrid(x, y)) return;
  const i = (y * GRID + x) * 4;
  buf[i] = rgb[0];
  buf[i + 1] = rgb[1];
  buf[i + 2] = rgb[2];
  buf[i + 3] = alpha;
}

const dot = (buf, cx, cy, r, color, alpha = 255) => {
  const m = newMask();
  disc(m, cx, cy, r);
  const rgb = hex(color);
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++)
      if (m[y * GRID + x]) put(buf, x, y, rgb, alpha);
};

/* ── 오리온자리 (6점) ──────────────────────────────────────
   허리가 띠 세 별 위에 놓이는 것이 이 그림의 유일한 필수 조건이다(검수 6절).
   그래서 골반·튜닉·다리 분기점을 모두 띠 선에서 파생시킨다.
   곤봉·방패·활은 대응하는 별이 없어 넣지 않는다. */
export function renderOrion() {
  const buf = new Uint8ClampedArray(GRID * GRID * 4);
  const { betelgeuse: LS, bellatrix: RS, alnitak: BL, mintaka: BR } = ORION;
  const shoulderMid = lerp(LS, RS, 0.5),
    beltMid = lerp(BL, BR, 0.5);
  const up = (() => {
    const dx = shoulderMid[0] - beltMid[0],
      dy = shoulderMid[1] - beltMid[1],
      L = Math.hypot(dx, dy);
    return [dx / L, dy / L];
  })();
  const down = [-up[0], -up[1]];
  const off = (p, d) => [p[0] + down[0] * d, p[1] + down[1] * d];
  // 띠 방향과 그 법선.  허리·골반·다리 분기는 전부 여기서 파생한다.
  const beltDir = (() => {
    const dx = BR[0] - BL[0],
      dy = BR[1] - BL[1],
      L = Math.hypot(dx, dy);
    return [dx / L, dy / L];
  })();
  const alongBelt = (d) => [
    beltMid[0] + beltDir[0] * d,
    beltMid[1] + beltDir[1] * d,
  ];
  const waistL = alongBelt(-6),
    waistR = alongBelt(6);
  const hipL = off(alongBelt(-5), 9),
    hipR = off(alongBelt(5), 9);

  // 사이프(왼발) 암시 — 뼈대에 없는 별이므로 가장 어두운 톤 한 겹, 반투명.
  const saiph = newMask();
  taper(
    saiph,
    [hipL, [hipL[0] - 11, hipL[1] + 13], [hipL[0] - 20, hipL[1] + 27]],
    4,
    2.6,
  );
  capsule(saiph, [hipL[0] - 20, hipL[1] + 27], [hipL[0] - 26, hipL[1] + 29], 2.6);

  // 가까운 다리 — 리겔이 발끝이다.  발은 별 자리에 정확히 둔다.
  const legs = newMask();
  const knee = [hipR[0] + 7, hipR[1] + 13];
  taper(legs, [hipR, knee, ORION.rigel], 5, 3.2);
  capsule(
    legs,
    ORION.rigel,
    [ORION.rigel[0] + 6, ORION.rigel[1] + 1.5],
    3.2,
  ); // 발

  // 몸통 — 어깨에서 띠까지 좁아지는 모래시계.  아래 변이 곧 띠 선이다.
  const torso = newMask();
  const shL = push(LS, shoulderMid, 3),
    shR = push(RS, shoulderMid, 3);
  poly(torso, [
    shL,
    shR,
    push(lerp(shR, waistR, 0.55), beltMid, -2.5),
    waistR,
    waistL,
    push(lerp(shL, waistL, 0.55), beltMid, -2.5),
  ]);
  disc(torso, LS[0], LS[1], 6.4); // 베텔게우스 어깨
  disc(torso, RS[0], RS[1], 6.4); // 벨라트릭스 어깨

  // 골반과 짧은 튜닉 — 두 다리의 분기를 덮어 인체로 읽히게 한다.
  const cloth = newMask();
  poly(cloth, [
    alongBelt(-6.5),
    alongBelt(6.5),
    off(alongBelt(8), 11),
    off(alongBelt(-8), 11),
  ]);

  // 팔 — 늘어뜨린 자세.  어깨 별에서 시작해야 어깨가 별로 읽힌다.
  const arms = newMask();
  taper(arms, [LS, [LS[0] - 9, LS[1] + 15], [LS[0] - 6, LS[1] + 30]], 4.2, 2.6);
  taper(arms, [RS, [RS[0] + 10, RS[1] + 14], [RS[0] + 12, RS[1] + 29]], 4.2, 2.6);

  const head = newMask();
  const headC = [shoulderMid[0] + up[0] * 12, shoulderMid[1] + up[1] * 12];
  disc(head, headC[0], headC[1], 6.2);
  capsule(head, off(headC, 5), off(headC, 9), 3.2); // 목
  const helm = newMask();
  disc(helm, headC[0], headC[1] - 1.5, 6.2);
  poly(
    helm,
    [
      [headC[0] - 8, headC[1] - 1],
      [headC[0] + 8, headC[1] - 1],
      [headC[0] + 8, headC[1] + 9],
      [headC[0] - 8, headC[1] + 9],
    ],
    true,
  );

  shade(buf, saiph, [PAL.cloth[2], PAL.cloth[2], PAL.cloth[2]], SAIPH_ALPHA);
  shade(buf, legs, PAL.leather);
  shade(buf, arms, PAL.leather);
  shade(buf, torso, PAL.bronze);
  shade(buf, cloth, PAL.cloth);
  shade(buf, head, PAL.skin);
  shade(buf, helm, PAL.bronze);

  // 띠 — 그림에서 가장 밝게. 세 별 위에 스터드를 정확히 얹는다.
  const belt = newMask();
  capsule(belt, push(BL, BR, 6), push(BR, BL, 6), 5.4);
  shade(buf, belt, PAL.bronze);
  const core = newMask();
  capsule(core, push(BL, BR, 4), push(BR, BL, 4), 1.6);
  shade(buf, core, [BELT_CORE, BELT_CORE, BELT_CORE]);
  for (const s of [ORION.alnitak, ORION.alnilam, ORION.mintaka])
    dot(buf, s[0], s[1], 3, BELT_STUD);
  for (const s of [LS, RS]) dot(buf, s[0], s[1], 1.8, STAR_MARK);
  dot(buf, ORION.rigel[0], ORION.rigel[1], 2, STAR_MARK);
  return { size: GRID, pixels: buf };
}

/* ── 북두칠성 (7점) ────────────────────────────────────────
   국자만 그린다(큰곰 전체 아님).  그릇은 벽 두께를 가진 금속이고,
   안쪽에 별빛이 담겨 있다 — 7점이 5점들보다 한 격 위인 것을 아트에서 내는 유일한 장치다. */
export function renderDipper() {
  const buf = new Uint8ClampedArray(GRID * GRID * 4);
  const { dubhe, merak, phecda, megrez, alioth, mizar, alkaid } = DIPPER;
  const bowl = [dubhe, merak, phecda, megrez],
    c = centroid(bowl);
  // 그릇 깊이 보강: 바닥(메라크–페크다) 쪽만 바깥으로 밀어낸다.
  const bottomMid = push(lerp(merak, phecda, 0.5), c, 9);
  // 금속은 뼈대 밖으로 추분하게 나가야 한다 — 선 글로우가 13px이라
  // 뼈대에 밀착한 및은 전장에서 선에 삼킨다.
  const outer = scaleAbout([dubhe, merak, bottomMid, phecda, megrez], 1.26, c);
  const cavity = scaleAbout([dubhe, merak, bottomMid, phecda, megrez], 0.84, c);

  const metal = newMask();
  poly(metal, outer);
  // 손잡이 — 메그레즈에서 알카이드까지, 끝만 살짝 감아 올린다.
  taper(
    metal,
    [
      megrez,
      alioth,
      mizar,
      alkaid,
      [alkaid[0] - 4, alkaid[1] + 4.5],
      [alkaid[0] - 9, alkaid[1] + 3.4],
    ],
    7.2,
    4.2,
  );
  poly(metal, cavity, true); // 안쪽을 파낸다

  const glow = newMask();
  poly(glow, cavity);

  shade(buf, metal, PAL.tin);
  shadeDepth(buf, glow, PAL.glow);

  // 그릇 입구(두베–메그레즈) 테두리를 밝게 — 국자의 방향을 정한다.
  const rim = newMask();
  capsule(rim, push(dubhe, megrez, 3), push(megrez, dubhe, 3), 3.4);
  poly(rim, cavity, true);
  shade(buf, rim, PAL.tinRim);

  for (const s of [dubhe, merak, phecda, megrez, alioth, mizar, alkaid])
    dot(buf, s[0], s[1], 2.2, STAR_MARK);
  // 담긴 별빛이 넘치는 흔적 두 점.  선 위로 올라가지 않게 그릇 안쪽에만.
  dot(buf, c[0] - 3, c[1] - 4, 1.2, "#ffffff");
  dot(buf, c[0] + 5, c[1] + 2, 1, "#ffffff");
  return { size: GRID, pixels: buf };
}

/* ── PNG 출력 ─────────────────────────────────────────────── */
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(
      raw,
      y * (width * 4 + 1) + 1,
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
// 확대는 최근접 ×3.  전장 캔버스가 imageSmoothingEnabled = false 이므로 보간하지 않는다.
function upscale({ size, pixels }) {
  const out = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const s = ((((y / SCALE) | 0) % size) * size + (((x / SCALE) | 0) % size)) * 4,
        d = (y * SIZE + x) * 4;
      out[d] = pixels[s];
      out[d + 1] = pixels[s + 1];
      out[d + 2] = pixels[s + 2];
      out[d + 3] = pixels[s + 3];
    }
  return out;
}

function main() {
  const outDir = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../assets/library/constellations",
  );
  mkdirSync(outDir, { recursive: true });
  for (const [name, render] of [
    ["orion", renderOrion],
    ["bigdipper", renderDipper],
  ]) {
    const png = encodePng(SIZE, SIZE, upscale(render()));
    writeFileSync(resolve(outDir, `${name}.png`), png);
    console.log(`${name}.png — ${SIZE}×${SIZE}, ${png.length} bytes`);
  }
}
if (process.argv[1] && process.argv[1].endsWith("generate_constellation_art_6_7.mjs"))
  main();
