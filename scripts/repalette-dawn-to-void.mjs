import { readFileSync, writeFileSync, readdirSync } from "node:fs";
const APPLY = process.argv.includes("--apply");
/* 표현 전용 파일만 돌린다. 제외 대상과 이유:
     boss-art.js      — 관측자의 몸은 저대비 청록-잿빛이어야 한다(규격 §1-4).
     js/game-*.js     — 캔버스 판정색·유닛 고유색은 연출이 건드리지 않는다(§1-1).
     game-arena-carve — 전장 바닥은 이미 월드별 색상 회전을 따로 갖고 있다. */
const DIR = "prototypes";
const JS_FILES = [
  "stella-ball-dawn.js",
  "sky-ambience.js",
  "stella-ball-pixel-ui.js",
];

const hex2rgb = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const rgb2hsl = ([r, g, b]) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    l = (mx + mn) / 2,
    d = mx - mn;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h =
    mx === r
      ? (g - b) / d + (g < b ? 6 : 0)
      : mx === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return [h * 60, s, l];
};
const hsl2hex = (h, s, l) => {
  h = (((h % 360) + 360) % 360) / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s,
    p = 2 * l - q;
  const c = (t) => {
    t = (t + 1) % 1;
    const v =
      t < 1 / 6
        ? p + (q - p) * 6 * t
        : t < 1 / 2
          ? q
          : t < 2 / 3
            ? p + (q - p) * (2 / 3 - t) * 6
            : p;
    return Math.round(v * 255);
  };
  return (
    "#" +
    [c(h + 1 / 3), c(h), c(h - 1 / 3)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
};

/* 찬 계열(청록~하늘, 150~235도)만 보이드 바이올렛으로 돌린다. 기준 시안의
   밤하늘(#140b2e~#03020c)과 보이드(#2a1442)가 모두 265~275도 대역이다.
   금색·크림은 건드리지 않는다 — 시안에서도 워드마크·CTA·별자리가 그대로
   금색이고, 손대면 「골드는 보상·CTA·별자리에만」이라는 §1-1 규칙이 깨진다.
   어두울수록 채도를 더 올린다. 그러지 않으면 회보라가 아니라 회색으로 읽힌다. */
const COLD_LO = 150,
  COLD_HI = 235,
  COLD_TARGET = 268;
// 기준 시안이 명시한 값으로 직접 옮기는 소수의 색.
const EXPLICIT = {
  "#c97a45": "#f2b35c", // --gold: 탄 주황 -> 시안의 밝은 금
  "#a05c32": "#c98a3e", // 버튼 그라디언트 아래쪽
  "#f0b078": "#ffd98e", // 버튼 그라디언트 위쪽
};
function convert(hex) {
  if (EXPLICIT[hex]) return EXPLICIT[hex];
  const [h, s, l] = rgb2hsl(hex2rgb(hex));
  if (s < 0.04) return null; // 무채색은 그대로
  if (h < COLD_LO || h > COLD_HI) return null; // 금색·자주·초록 등은 그대로
  const t = (h - COLD_LO) / (COLD_HI - COLD_LO);
  // 어두운 색일수록 채도 배수를 키운다 (l 0.05에서 2.0배, l 0.5 이상에서 1.1배)
  const boost = 1.1 + Math.max(0, 0.45 - l) * 2.0;
  return hsl2hex(COLD_TARGET - 14 + t * 28, Math.min(0.78, s * boost), l);
}

let total = 0,
  changed = 0;
const report = {};
const targets = [
  ...readdirSync(DIR).filter((x) => x.endsWith(".css")),
  ...JS_FILES,
];
for (const f of targets) {
  const src = readFileSync(`${DIR}/${f}`, "utf8");
  let n = 0;
  const out = src.replace(/#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?\b/g, (m) => {
    total++;
    const base = m.slice(0, 7).toLowerCase(),
      alpha = m.slice(7);
    const next = convert(base);
    if (!next) return m;
    n++;
    changed++;
    return next + alpha;
  });
  report[f] = n;
  if (APPLY && n) writeFileSync(`${DIR}/${f}`, out);
}
console.log(APPLY ? "=== 적용 ===" : "=== 시험 실행 (변경 없음) ===");
for (const [f, n] of Object.entries(report))
  console.log(`  ${f.padEnd(32)} ${n}`);
console.log(
  `\n총 ${total}개 중 ${changed}개 변환 (${((100 * changed) / total).toFixed(0)}%)`,
);
console.log("\n주요 색 변환 예시:");
for (const h of [
  "#0a0f12",
  "#101a1e",
  "#16242a",
  "#223438",
  "#34494d",
  "#42585c",
  "#8ba39f",
  "#cfdad7",
  "#c97a45",
  "#f0b078",
  "#ffd2a0",
  "#f6c48e",
  "#f3ede2",
]) {
  const n = convert(h);
  console.log(`  ${h} -> ${n || "(그대로)"}`);
}
