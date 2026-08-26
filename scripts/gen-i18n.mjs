import { readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2]; // workflow output json
const DEST = process.argv[3]; // game-i18n.js path

const raw = JSON.parse(readFileSync(OUT, "utf8"));
const pairs = raw.result.pairs;

// Build ko->en map. Skip empty / identical / where en is missing.
const map = {};
let skipped = 0;
for (const p of pairs) {
  if (!p || typeof p.ko !== "string" || typeof p.en !== "string") { skipped++; continue; }
  const ko = p.ko;
  const en = p.en;
  if (!ko.trim() || !en.trim()) { skipped++; continue; }
  if (ko === en) { skipped++; continue; }
  // only keep entries that actually contain Hangul (defensive)
  if (!/[가-힣]/.test(ko)) { skipped++; continue; }
  if (!(ko in map)) map[ko] = en;
}

const entries = Object.entries(map);
// Emit as a JS object literal, escaping properly via JSON.stringify per key/value.
const body = entries
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
  .join("\n");

const file = `/* eslint-disable */
/* ──────────────────────────────────────────────────────────────────────────
   English localization map + overlay observer (feature/full-english-i18n).
   자동 생성: scripts/gen-i18n.mjs (워크플로 번역 결과에서). 손으로 고치지 말 것.
   한국어가 원본이다. settings.language === "en" 일 때, #overlay 안의 텍스트
   노드 중 «전체가 정확히» 아래 키와 일치하는 것을 영어로 치환한다. 부분/연결
   문자열(값이 끼인 것)은 여기서 안 잡히므로 소스에서 따로 감싼다. 데이터
   객체(별지기·자리)는 game-data.js의 applyDataLanguage가 이미 스왑한다.
   ────────────────────────────────────────────────────────────────────────── */
const I18N_EN = {
${body}
};

function i18nActive() {
  return typeof settings !== "undefined" && settings && settings.language === "en";
}

/* 텍스트 노드를 «전체 정확 일치»로만 바꾼다. 앞뒤 공백은 보존한다. 값이 낀
   노드(숫자·이름 연결)는 트림해도 키와 안 맞으므로 그대로 둔다 — 잘못된 부분
   치환으로 UI를 깨뜨리지 않는다. aria-label/placeholder/title도 같은 규칙. */
function i18nLocalize(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  for (const t of nodes) {
    const rawv = t.nodeValue;
    const key = rawv.trim();
    if (!key) continue;
    const en = I18N_EN[key];
    if (en != null && en !== key) t.nodeValue = rawv.replace(key, en);
  }
  if (root.querySelectorAll) {
    for (const el of root.querySelectorAll("[aria-label],[placeholder],[title]")) {
      for (const attr of ["aria-label", "placeholder", "title"]) {
        const v = el.getAttribute(attr);
        if (!v) continue;
        const en = I18N_EN[v.trim()];
        if (en != null && en !== v.trim()) el.setAttribute(attr, v.replace(v.trim(), en));
      }
    }
  }
}

/* #overlay를 감시한다. 화면이 바뀔 때마다(그리고 로드 시) 영어면 다시 지역화
   한다. 자기 자신의 치환이 옵저버를 다시 깨우지 않도록 치환 동안 감시를 끊는다
   — 영어 텍스트는 어떤 키와도 안 맞으므로 재귀도 없지만, 확실히 한다. */
let _i18nObserver = null;
function i18nRun(overlay) {
  if (!i18nActive()) return;
  if (_i18nObserver) _i18nObserver.disconnect();
  i18nLocalize(overlay);
  if (_i18nObserver)
    _i18nObserver.observe(overlay, { childList: true, subtree: true, characterData: true });
}
function startI18n() {
  const overlay = document.getElementById("overlay");
  if (!overlay) {
    setTimeout(startI18n, 100);
    return;
  }
  _i18nObserver = new MutationObserver(() => i18nRun(overlay));
  i18nRun(overlay);
  if (i18nActive())
    _i18nObserver.observe(overlay, { childList: true, subtree: true, characterData: true });
  /* 언어 토글 시 game-meta.js가 재렌더하므로 옵저버가 잡는다. 하지만 토글로
     «영어로» 처음 켤 때 옵저버가 아직 안 붙어 있을 수 있으니, 전역 훅을 둔다. */
  window.__i18nApply = () => i18nRun(overlay);
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", startI18n);
else startI18n();
`;

writeFileSync(DEST, file, "utf8");
console.log(`wrote ${DEST}: ${entries.length} entries, skipped ${skipped}`);
