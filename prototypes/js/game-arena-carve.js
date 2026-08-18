// Arena floor pass — "Observatory Ground" (design turn 4a).
//
// Installs a fully procedural floor so the table
// stops carrying the old indigo/violet terrain set while the DOM runs the
// Dawn Observatory palette.  Nothing here loads an image: the floor is
// voronoi stone plates, an engraved astrolabe carrying the stage's own
// constellation, two-pole lighting (void violet at the top, launch apricot
// at the bottom) and an inner wall shadow.
//
// Ownership: this file only installs the render module's stage-arena strategy.
// It never touches gameplay state, collisions, or the canvas judgement colours
// of units.
//
// Load order: after `js/game-onboarding.js`, before `js/game-bootstrap.js`.
// Add the same path to `expectedScripts` in `scripts/smoke-runtime.mjs`.

const CARVE_WALL = 18;
const CARVE_CACHE_LIMIT = 4;
const CARVE_PLATE_RAMP = [
  "#0b1519",
  "#0d181c",
  "#0f1b1f",
  "#0a1317",
  "#101e22",
];
const carveLayers = new Map();

// Deterministic hash noise.  Every stage gets the same floor on every run,
// which matters because the daily seed must not change what the table looks
// like — only what the boss does.
function carveNoise(a, b) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/* 월드 순서. 바닥색은 통산 스테이지 번호가 아니라 이 순서로 정한다.
   예전 값 `min(0.85, 0.28 + index * 0.05)`은 index 12에서 상한에 닿아
   4-1부터 마지막까지 23개 스테이지가 완전히 같은 색이었고, 애초에 월드
   경계와 맞지 않아 한 월드 안에서 스테이지마다 색이 변했다. */
const CARVE_WORLD_ORDER = [
  "aries",
  "sagitta",
  "corvus",
  "cass",
  "cygnus",
  "orion",
  "ursa",
  "outside",
];
function carveWorldIndex(index) {
  const at = CARVE_WORLD_ORDER.indexOf(stages[index]?.world);
  return at < 0 ? 0 : at;
}
// The void gets denser as the campaign moves outward.  This is presentation
// only; it reads as difficulty without touching a single balance number.
// 월드 여덟 개에 고르게 편다 — 마지막 월드에서만 상한에 닿는다.
function carveVioletFor(index) {
  const span = CARVE_WORLD_ORDER.length - 1;
  return 0.3 + (carveWorldIndex(index) / span) * 0.55;
}
/* 돌판 색조도 월드를 따라간다. 밝기와 채도는 건드리지 않고 색상만 옮기므로
   새벽 관측소의 어두운 바탕은 그대로다. 청록(양자리)에서 보랏빛(바깥)으로
   가는 70도짜리 호 하나만 쓴다 — 공허가 짙어진다는 기존 연출과 같은 방향이라
   두 신호가 서로를 거스르지 않는다. */
const CARVE_WORLD_HUE_ARC = 70;
function carveHueShift(hex, deg) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255,
    g = ((n >> 8) & 255) / 255,
    b = (n & 255) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2,
    d = max - min;
  if (d === 0) return hex;
  const sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h =
    max === r
      ? (g - b) / d + (g < b ? 6 : 0)
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  h = (h / 6 + deg / 360) % 1;
  const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat,
    pp = 2 * l - q;
  const chan = (t) => {
    t = (t + 1) % 1;
    const v =
      t < 1 / 6
        ? pp + (q - pp) * 6 * t
        : t < 1 / 2
          ? q
          : t < 2 / 3
            ? pp + (q - pp) * (2 / 3 - t) * 6
            : pp;
    return Math.round(v * 255);
  };
  const out = (chan(h + 1 / 3) << 16) | (chan(h) << 8) | chan(h - 1 / 3);
  return "#" + out.toString(16).padStart(6, "0");
}
function carveRampFor(index) {
  const span = CARVE_WORLD_ORDER.length - 1;
  const deg = (carveWorldIndex(index) / span) * CARVE_WORLD_HUE_ARC;
  if (deg === 0) return CARVE_PLATE_RAMP;
  return CARVE_PLATE_RAMP.map((hex) => carveHueShift(hex, deg));
}

function carveFigureFor(index) {
  const worldId = stages[index]?.world;
  const world = WORLDS.find((entry) => entry.id === worldId);
  return world?.shape ?? WORLDS[0].shape;
}

// Voronoi plates baked at 4px.  A tiled PNG repeats every 128px and the seam
// is visible; a voronoi field has no period at all, so the floor never shows
// a grid the player can accidentally read as gameplay information.
function carvePlates(layerX, seed, ramp) {
  const count = 78;
  const sx = [];
  const sy = [];
  const shade = [];
  for (let i = 0; i < count; i++) {
    sx.push(carveNoise(i + seed, 1.7) * W);
    sy.push(carveNoise(i + seed, 4.3) * H);
    shade.push(
      ramp[Math.floor(carveNoise(i + seed, 9.1) * ramp.length) % ramp.length],
    );
  }
  const cols = W / 4;
  const owner = new Int16Array(cols * (H / 4));
  for (let py = 0, gy = 0; py < H; py += 4, gy++) {
    for (let px = 0, gx = 0; px < W; px += 4, gx++) {
      let best = 1e9;
      let second = 1e9;
      let bestIndex = 0;
      for (let i = 0; i < count; i++) {
        const dx = px - sx[i];
        const dy = (py - sy[i]) * 1.14;
        const d = dx * dx + dy * dy;
        if (d < best) {
          second = best;
          best = d;
          bestIndex = i;
        } else if (d < second) second = d;
      }
      owner[gy * cols + gx] = bestIndex;
      const seam = Math.sqrt(second) - Math.sqrt(best);
      layerX.fillStyle =
        seam < 3 ? "#060d10" : seam < 7 ? "#081115" : shade[bestIndex];
      layerX.fillRect(px, py, 4, 4);
    }
  }
  // One highlight row on each plate's upper edge.  This is the whole reason
  // the floor reads as slabs with thickness instead of flat noise.
  layerX.fillStyle = "#18292d";
  for (let gy = 1; gy < H / 4; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      if (
        owner[gy * cols + gx] !== owner[(gy - 1) * cols + gx] &&
        carveNoise(gx, gy) > 0.45
      )
        layerX.fillRect(gx * 4, gy * 4, 4, 1);
    }
  }
}

function carveDotRing(layerX, cx, cy, r, col, gap, size) {
  layerX.fillStyle = col;
  const step = gap / r;
  for (let a = 0; a < Math.PI * 2; a += step)
    layerX.fillRect(
      Math.round(cx + Math.cos(a) * r),
      Math.round(cy + Math.sin(a) * r),
      size,
      size,
    );
}

// The engraving is the stage's own constellation, so `1-x` and `2-x` are
// legible as different places without shipping a second terrain set.
function carveAstrolabe(layerX, cx, cy, r, figure, col, hot) {
  carveDotRing(layerX, cx, cy, r, col, 9, 2);
  carveDotRing(layerX, cx, cy, r * 0.62, col, 11, 2);
  layerX.fillStyle = col;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const big = i % 4 === 0;
    const len = big ? 16 : 8;
    const x1 = cx + Math.cos(a) * r;
    const y1 = cy + Math.sin(a) * r;
    for (let s = 0; s < len; s += 3)
      layerX.fillRect(
        Math.round(x1 - Math.cos(a) * s),
        Math.round(y1 - Math.sin(a) * s),
        big ? 3 : 2,
        big ? 3 : 2,
      );
  }
  const points = figure.map(([fx, fy]) => [
    cx + (fx / 100 - 0.5) * r * 2.1,
    cy + (fy / 100 - 0.45) * r * 1.6,
  ]);
  // Stage 8-1 belongs to a world with no constellation at all, so the dial
  // keeps its rings and ticks but has no figure to trace.
  if (!points.length) return;
  layerX.strokeStyle = col;
  layerX.lineWidth = 2;
  layerX.setLineDash([3, 5]);
  layerX.beginPath();
  layerX.moveTo(points[0][0], points[0][1]);
  for (const [px, py] of points.slice(1)) layerX.lineTo(px, py);
  layerX.stroke();
  layerX.setLineDash([]);
  points.forEach(([px, py], i) => {
    layerX.fillStyle = i === 0 || i === points.length - 1 ? hot : col;
    layerX.fillRect(Math.round(px) - 5, Math.round(py) - 1, 10, 3);
    layerX.fillRect(Math.round(px) - 1, Math.round(py) - 5, 3, 10);
    layerX.fillRect(Math.round(px) - 3, Math.round(py) - 3, 6, 6);
  });
}

function carveDebris(layerX, seed) {
  for (let i = 0; i < 34; i++) {
    const px = 40 + carveNoise(i + seed, 2.2) * (W - 80);
    const py = 40 + carveNoise(i + seed, 6.6) * (H - 80);
    const s = 3 + Math.floor(carveNoise(i + seed, 8.8) * 3) * 3;
    layerX.fillStyle = "#0a1215";
    layerX.fillRect(Math.round(px) - 1, Math.round(py) + 2, s + 2, 3);
    layerX.fillStyle = "#1a2e33";
    layerX.fillRect(Math.round(px), Math.round(py), s, s);
    layerX.fillStyle = "#2b4a4e";
    layerX.fillRect(Math.round(px), Math.round(py), s, 2);
  }
}

// The colossus cracked the ground it stands on.  Drawn over the engraving so
// the void reads as damage to the observatory, not as another floor pattern.
function carveBossFracture(layerX, bx, by, violet, seed) {
  layerX.fillStyle = "#2a1442";
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 7) {
    const jitter = carveNoise(a + seed, 5) * 0.3 - 0.15;
    const len = 120 + carveNoise(a, 2) * 130 * (0.6 + violet);
    for (let r = 46; r < len; r += 4) {
      const px = bx + Math.cos(a + jitter + r * 0.0012) * r;
      const py = by + Math.sin(a + jitter + r * 0.0012) * r * 1.05;
      if (carveNoise(px, py) > 0.34)
        layerX.fillRect(Math.round(px / 3) * 3, Math.round(py / 3) * 3, 3, 3);
    }
  }
}

// Two poles, nothing in between: violet where the void stands, apricot at the
// launch stone.  The middle of the table stays dark so units and the aim
// guide are the brightest things on screen.
function carveLighting(layerX, bx, by, violet) {
  const voidGlow = layerX.createRadialGradient(
    bx,
    by + 10,
    20,
    bx,
    by + 10,
    340 + violet * 170,
  );
  voidGlow.addColorStop(0, `rgba(163,96,230,${(0.36 * violet).toFixed(3)})`);
  voidGlow.addColorStop(0.44, `rgba(112,60,170,${(0.18 * violet).toFixed(3)})`);
  voidGlow.addColorStop(1, "rgba(70,38,110,0)");
  layerX.fillStyle = voidGlow;
  layerX.fillRect(0, 0, W, H);
  const launchGlow = layerX.createRadialGradient(
    W / 2,
    H - 40,
    20,
    W / 2,
    H - 40,
    300,
  );
  launchGlow.addColorStop(0, "rgba(226,150,90,.13)");
  launchGlow.addColorStop(1, "rgba(226,150,90,0)");
  layerX.fillStyle = launchGlow;
  layerX.fillRect(0, 0, W, H);
}

function carveDust(layerX, seed) {
  for (let i = 0; i < 130; i++) {
    const px = carveNoise(i + seed, 11) * W;
    const py = carveNoise(i + seed, 13) * H;
    const brightness = carveNoise(i, 17);
    layerX.fillStyle =
      brightness > 0.88 ? "#4f7b74" : brightness > 0.6 ? "#2b4449" : "#1d3236";
    layerX.fillRect(Math.round(px), Math.round(py), 2, 2);
  }
}

// The wall is the surface the meteor bounces off, so it is drawn as one, not
// as a repeated 128px strip: three bevel bands, a 40px reflection tick rule,
// and 45-degree corner cuts that show where a corner shot goes.
function carveWall(layerX) {
  const t = CARVE_WALL;
  layerX.fillStyle = "#0a1417";
  layerX.fillRect(0, 0, W, t);
  layerX.fillRect(0, H - t, W, t);
  layerX.fillRect(0, 0, t, H);
  layerX.fillRect(W - t, 0, t, H);
  layerX.fillStyle = "#24393d";
  layerX.fillRect(3, 3, W - 6, t - 6);
  layerX.fillRect(3, H - t + 3, W - 6, t - 6);
  layerX.fillRect(3, 3, t - 6, H - 6);
  layerX.fillRect(W - t + 3, 3, t - 6, H - 6);
  layerX.fillStyle = "#4d7a7a";
  layerX.fillRect(t, t - 1, W - t * 2, 1);
  layerX.fillRect(t, H - t, W - t * 2, 1);
  layerX.fillRect(t - 1, t, 1, H - t * 2);
  layerX.fillRect(W - t, t, 1, H - t * 2);
  layerX.fillStyle = "#7cc6bb";
  for (let px = t + 40; px < W - t; px += 40) {
    layerX.fillRect(px, t - 5, 2, 4);
    layerX.fillRect(px, H - t + 1, 2, 4);
  }
  for (let py = t + 40; py < H - t; py += 40) {
    layerX.fillRect(t - 5, py, 4, 2);
    layerX.fillRect(W - t + 1, py, 4, 2);
  }
  layerX.fillStyle = "#0a1417";
  for (let i = 0; i < 30; i += 3) {
    layerX.fillRect(t, t + i, 30 - i, 3);
    layerX.fillRect(W - t - (30 - i), t + i, 30 - i, 3);
    layerX.fillRect(t, H - t - i - 3, 30 - i, 3);
    layerX.fillRect(W - t - (30 - i), H - t - i - 3, 30 - i, 3);
  }
}

function carveInnerShadow(layerX) {
  const depth = 46;
  const t = CARVE_WALL;
  const sides = [
    [layerX.createLinearGradient(0, t, 0, t + depth), t, t, W - t * 2, depth],
    [
      layerX.createLinearGradient(0, H - t, 0, H - t - depth),
      t,
      H - t - depth,
      W - t * 2,
      depth,
    ],
    [layerX.createLinearGradient(t, 0, t + depth, 0), t, t, depth, H - t * 2],
    [
      layerX.createLinearGradient(W - t, 0, W - t - depth, 0),
      W - t - depth,
      t,
      depth,
      H - t * 2,
    ],
  ];
  for (const [gradient, gx, gy, gw, gh] of sides) {
    gradient.addColorStop(0, "rgba(3,7,9,.72)");
    gradient.addColorStop(1, "rgba(3,7,9,0)");
    layerX.fillStyle = gradient;
    layerX.fillRect(gx, gy, gw, gh);
  }
}

// The floor never animates, so recently visited stages keep their baked layer.
// Each canvas is 720x900, though, so an LRU cap prevents a full campaign tour
// from retaining roughly 90 MiB of pixel buffers.
function buildCarveLayer(index) {
  const key = String(index);
  if (carveLayers.has(key)) {
    const cached = carveLayers.get(key);
    carveLayers.delete(key);
    carveLayers.set(key, cached);
    return cached;
  }
  const layer = document.createElement("canvas");
  layer.width = W;
  layer.height = H;
  const layerX = layer.getContext("2d");
  layerX.imageSmoothingEnabled = false;
  const violet = carveVioletFor(index);
  const seed = index * 4 + 1;
  const bx = stages[index]?.boss?.x ?? W / 2;
  const by = stages[index]?.boss?.y ?? 196;
  layerX.fillStyle = "#080e11";
  layerX.fillRect(0, 0, W, H);
  carvePlates(layerX, seed, carveRampFor(index));
  carveAstrolabe(
    layerX,
    W / 2,
    462,
    244,
    carveFigureFor(index),
    "#1c383c",
    "#3f6f5f",
  );
  carveDebris(layerX, seed);
  carveBossFracture(layerX, bx, by, violet, seed);
  carveLighting(layerX, bx, by, violet);
  carveDust(layerX, seed);
  carveInnerShadow(layerX);
  carveWall(layerX);
  carveLayers.set(key, layer);
  while (carveLayers.size > CARVE_CACHE_LIMIT) {
    carveLayers.delete(carveLayers.keys().next().value);
  }
  return layer;
}

function drawCarvedStageArena(drawFallback) {
  const layer = buildCarveLayer(stageIndex);
  if (!layer) {
    drawFallback();
    return;
  }
  x.drawImage(layer, 0, 0);
}

StellaRuntime.modules.require("render").installStageArena(drawCarvedStageArena);
