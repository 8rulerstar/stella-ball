import { readFileSync, writeFileSync } from "node:fs";

// Usage: node gen-i18n.mjs <source-pairs.json> <dest game-i18n.js>
// source-pairs.json may be either a bare [{ko,en}] array or {result:{pairs:[...]}}.
const SRC = process.argv[2];
const DEST = process.argv[3];

const parsed = JSON.parse(readFileSync(SRC, "utf8"));
const pairs = Array.isArray(parsed) ? parsed : parsed.result.pairs;

const map = {};
let skipped = 0;
for (const p of pairs) {
  if (!p || typeof p.ko !== "string" || typeof p.en !== "string") { skipped++; continue; }
  if (!p.ko.trim() || !p.en.trim()) { skipped++; continue; }
  if (p.ko === p.en) { skipped++; continue; }
  if (!/[가-힣]/.test(p.ko)) { skipped++; continue; }
  if (!(p.ko in map)) map[p.ko] = p.en;
}

const body = Object.entries(map)
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
  .join("\n");

/* 엄선된 «조각» 치환. 전체-노드 정확 일치로 안 잡히는 «값이 낀» 노드를 위한
   순서 있는 부분 문자열 치환이다(골드 금액·기믹 카운트·<br>로 쪼개진 조각).
   ⚠ 반드시 «다른 단어의 일부로는 안 나오는» 여러 글자 용어만, 그리고 긴 것
   먼저. 짧고 흔한 조각(별·달·해 등)은 절대 넣지 말 것 — 긴 단어를 부순다. */
const FRAG = [
  ["유성을 굴려 별빛을 만들고, 빛나는 곳을 세 군데 골라 조준하세요.", "Roll the meteor to make starlight, then aim at three glowing spots."],
  ["고르지 않고 남겨 둔 별빛이 별자리가 됩니다.", "Starlight left unpicked becomes a constellation."],
  ["루나의 관측 수업", "Luna's Observation Lesson"],
  ["불멸의 허수아비", "Immortal Scarecrow"],
  ["훈련 시작", "Start Training"],
  ["관측 항로", "Observation Route"],
  ["보유 골드", "Gold Held"],
  ["보유 무기", "Weapons Owned"],
  ["골드 부족", "Not enough gold"],
  ["관측 잔광", "Guide Star"],
  ["반사 벽", "Bounce Wall"],
  ["훈련장", "Training Ground"],
  ["1번 자리", "Seat 1"],
  ["2번 자리", "Seat 2"],
  ["3번 자리", "Seat 3"],
  ["3명", "3"],
  ["골드 필요", "gold needed"],
  ["보상", "Reward"],
  ["무한", "Endless"],
  ["훈련", "Training"],
  ["골드", "Gold"],
];
const fragBody = FRAG.map(([k, v]) => `  [${JSON.stringify(k)}, ${JSON.stringify(v)}],`).join("\n");

const file = `/* eslint-disable */
/* ──────────────────────────────────────────────────────────────────────────
   English localization map + overlay observer (feature/full-english-i18n).
   자동 생성: scripts/gen-i18n.mjs — 원천은 scripts/i18n-source-pairs.json.
   손으로 고치지 말 것(재생성 시 덮어씀). 문구를 고치려면 원천 JSON을 고치고
   node scripts/gen-i18n.mjs scripts/i18n-source-pairs.json prototypes/js/game-i18n.js.

   한국어가 원본이다. settings.language === "en" 일 때 #overlay 안 텍스트 노드를
   지역화한다: ① 노드 전체가 정확히 I18N_EN 키와 같으면 통째로 치환, ② 남은
   한글 노드는 I18N_FRAG(엄선된 안전 조각)로 부분 치환한다. 데이터 객체(별지기·
   자리·무기·도색·월드·스테이지)는 game-data.js의 applyDataLanguage가 스왑한다.
   ────────────────────────────────────────────────────────────────────────── */
const I18N_EN = {
${body}
};

/* 값-혼합·조각 노드용 부분 치환(순서대로, 긴 것 먼저). */
const I18N_FRAG = [
${fragBody}
];

function i18nActive() {
  return typeof settings !== "undefined" && settings && settings.language === "en";
}

function i18nApplyFragments(s) {
  let out = s;
  for (const [ko, en] of I18N_FRAG) {
    if (out.indexOf(ko) !== -1) out = out.split(ko).join(en);
  }
  return out;
}

/* 텍스트 노드 지역화. 전체 정확 일치 우선, 남은 한글은 조각 치환. 앞뒤 공백
   보존. aria-label/placeholder/title도 같은 규칙. */
function i18nLocalize(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  for (const t of nodes) {
    const rawv = t.nodeValue;
    const key = rawv.trim();
    if (!key || !/[가-힣]/.test(key)) continue;
    const en = I18N_EN[key];
    if (en != null && en !== key) {
      t.nodeValue = rawv.replace(key, en);
      continue;
    }
    const frag = i18nApplyFragments(key);
    if (frag !== key) t.nodeValue = rawv.replace(key, frag);
  }
  if (root.querySelectorAll) {
    for (const el of root.querySelectorAll("[aria-label],[placeholder],[title]")) {
      for (const attr of ["aria-label", "placeholder", "title"]) {
        const v = el.getAttribute(attr);
        if (!v || !/[가-힣]/.test(v)) continue;
        const key = v.trim();
        const en = I18N_EN[key] != null ? I18N_EN[key] : i18nApplyFragments(key);
        if (en !== key) el.setAttribute(attr, v.replace(key, en));
      }
    }
  }
}

/* <main>을 감시한다 — 메뉴(#overlay)와 전투 HUD(발사·남은 유성·조작 안내·
   별자리 배율 등)가 모두 그 안에 있다. 화면이 바뀔 때마다(그리고 로드 시)
   영어면 다시 지역화한다. childList+subtree 만 본다: 전투 중 숫자(체력·콤보·
   운동량)는 characterData 로 초당 여러 번 갱신되는데, 그건 지역화할 필요가
   없고 감시하면 부하만 준다. 라벨의 최초 렌더는 innerHTML(=childList)이라
   이걸로 다 잡힌다. 자기 치환이 옵저버를 다시 안 깨우게 치환 동안 끊는다. */
const I18N_OBS_OPTS = { childList: true, subtree: true };
let _i18nObserver = null;
function i18nRun(root) {
  if (!i18nActive()) return;
  if (_i18nObserver) _i18nObserver.disconnect();
  i18nLocalize(root);
  if (_i18nObserver) _i18nObserver.observe(root, I18N_OBS_OPTS);
}
function startI18n() {
  const root = document.querySelector("main") || document.body;
  if (!root) {
    setTimeout(startI18n, 100);
    return;
  }
  _i18nObserver = new MutationObserver(() => i18nRun(root));
  i18nRun(root);
  if (i18nActive()) _i18nObserver.observe(root, I18N_OBS_OPTS);
  window.__i18nApply = () => i18nRun(root);
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", startI18n);
else startI18n();
`;

writeFileSync(DEST, file, "utf8");
console.log(`wrote ${DEST}: ${Object.keys(map).length} entries, ${FRAG.length} fragments, skipped ${skipped}`);
