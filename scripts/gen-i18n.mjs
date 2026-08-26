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
  if (!p || typeof p.ko !== "string" || typeof p.en !== "string") {
    skipped++;
    continue;
  }
  if (!p.ko.trim()) {
    skipped++;
    continue;
  }
  if (p.ko === p.en) {
    skipped++;
    continue;
  }
  if (!/[가-힣]/.test(p.ko)) {
    skipped++;
    continue;
  }
  // 키·값의 앞뒤 공백을 벗긴다. 조회는 t()/i18nLocalize 모두 s.trim() 으로 하므로
  // 패딩된 키는 도달 불가(죽은 항목)였고, 패딩된 값은 앞뒤 이중 공백을 냈다.
  // 공백은 원문(s)에서 replace 가 보존하므로 값도 trim 이 맞다.
  const _k = p.ko.trim();
  // 명시적 «드롭» 표식(∅)은 빈 문자열로 — 「5개」의 "개" 처럼 영어에 대응어가
  // 없어 지워야 하는 단위용. 그 외의 빈 값은 우연이므로 버린다.
  let _v = p.en.trim();
  if (_v === "∅") _v = "";
  else if (!_v) {
    skipped++;
    continue;
  }
  if (!_k) {
    skipped++;
    continue;
  }
  if (!(_k in map)) map[_k] = _v;
}

const body = Object.entries(map)
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
  .join("\n");

/* 엄선된 «조각» 치환. 전체-노드 정확 일치로 안 잡히는 «값이 낀» 노드를 위한
   순서 있는 부분 문자열 치환이다(골드 금액·기믹 카운트·<br>로 쪼개진 조각).
   ⚠ 반드시 «다른 단어의 일부로는 안 나오는» 여러 글자 용어만, 그리고 긴 것
   먼저. 짧고 흔한 조각(별·달·해 등)은 절대 넣지 말 것 — 긴 단어를 부순다. */
const FRAG = [
  [
    "유성을 굴려 별빛을 만들고, 빛나는 곳을 세 군데 골라 조준하세요.",
    "Roll the meteor to make starlight, then aim at three glowing spots.",
  ],
  [
    "고르지 않고 남겨 둔 별빛이 별자리가 됩니다.",
    "Starlight left unpicked becomes a constellation.",
  ],
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
const fragBody = FRAG.map(
  ([k, v]) => `  [${JSON.stringify(k)}, ${JSON.stringify(v)}],`,
).join("\n");

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

/* 캔버스(ctx.fillText)로 그리는 텍스트용. DOM 관찰자가 못 닿으므로 소스에서
   이 함수로 한국어 문자열을 감싼다. en 모드가 아니면 원문 그대로. 앞뒤 공백은
   보존한다(«이름 + t(" · 각성")» 같은 연결을 위해). */
function t(s) {
  if (typeof s !== "string" || !i18nActive() || !/[가-힣]/.test(s)) return s;
  const key = s.trim();
  const en = I18N_EN[key];
  if (en != null && en !== key) return s.replace(key, en);
  const frag = i18nApplyFragments(key);
  return frag !== key ? s.replace(key, frag) : s;
}
if (typeof window !== "undefined") window.t = t;

/* 관찰자가 «한국어→영어»로 바꾼 텍스트 노드의 원본을 기억한다. 언어를 다시
   한국어로 돌릴 때(전투 «중» 토글처럼 재렌더가 안 되는 자리) 이 원본으로
   되돌린다. 재렌더로 사라진 옛 노드는 WeakMap 에서 자연히 GC 된다. */
const _i18nOrig = new WeakMap();

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
      if (!_i18nOrig.has(t)) _i18nOrig.set(t, rawv);
      t.nodeValue = rawv.replace(key, en);
      continue;
    }
    const frag = i18nApplyFragments(key);
    if (frag !== key) {
      if (!_i18nOrig.has(t)) _i18nOrig.set(t, rawv);
      t.nodeValue = rawv.replace(key, frag);
    }
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
/* 지역화된 노드를 원본 한국어로 되돌린다(EN→KO 토글). 새로 렌더된 노드는
   애초에 한국어라 WeakMap 에 없어 건드리지 않는다. */
function i18nRestore(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let n;
  while ((n = walker.nextNode())) {
    const orig = _i18nOrig.get(n);
    if (orig != null && n.nodeValue !== orig) n.nodeValue = orig;
  }
}

const I18N_OBS_OPTS = { childList: true, subtree: true };
let _i18nObserver = null;
function i18nRun(root) {
  // 한국어면 감시를 «끊고», 지역화했던 노드를 원본으로 되돌린다. 예전엔 그냥
  // return 이라 (1) EN→KO 후 <main> 관찰자가 계속 붙어 헛돌았고 (2) 전투 «중»
  // 토글 시 정적 HUD 라벨이 영어로 남았다.
  if (!i18nActive()) {
    if (_i18nObserver) _i18nObserver.disconnect();
    i18nRestore(root);
    return;
  }
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
console.log(
  `wrote ${DEST}: ${Object.keys(map).length} entries, ${FRAG.length} fragments, skipped ${skipped}`,
);
