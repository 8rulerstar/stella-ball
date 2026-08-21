/**
 * 겹쳐 깔린 «전면 레이어»를 센다 — 창이 커질수록 비싸지는 유일한 축.
 *
 * 캔버스 백버퍼는 720x900 고정이라 창을 키워도 그리기 «호출 수»는 그대로다.
 * 커지는 것은 합성해야 할 «면적»이고, 그 면적은 전면을 덮은 레이어 장수에
 * 비례한다. probe-window-scale.mjs 가 「창을 키우면 무엇이 커지나」를 재는
 * 도구라면 여기는 「지금 몇 장이 깔려 있나, 그중 판을 가리는 것은 몇 장인가」를
 * 화면별로 잰다.
 *
 * 이 프로브가 틀리는 법 (겪은 것만 적는다):
 * 1. display:none 과 visibility:hidden 은 비용이 0이다. 사각형 크기만 보고
 *    세면 숨은 오버레이가 전부 «깔려 있다»로 잡힌다 — 반드시 뺀다.
 * 2. opacity:0 은 «장수»에는 들어가도 «칠하는 픽셀»에는 안 들어간다. 크롬은
 *    투명한 것을 칠하지 않는다. 그래서 따로 센다.
 * 3. 화면 밖으로 밀어 둔 레이어(transform: translate)도 사각형은 크다.
 *    뷰포트와 겹치는 면적으로 잘라야 한다.
 * 4. 불투명한 것이 위에 있으면 아래는 가려져 안 칠할 수 있다(occlusion). 다만
 *    transform·filter·will-change 가 붙으면 자기 레이어로 승격돼 그 최적화가
 *    깨진다 — 그래서 승격 여부를 함께 적는다.
 * 5. 전투 입장 시네마가 4.2초간 돈다. 그 안에 재면 레터박스와 베일(0.42)이
 *    «상시 깔린 덮개»로 잡힌다 — 실제로 첫 판에서 그렇게 오독했다. 판이
 *    열린 뒤(`battleCine` 해제)에 재야 정상 상태다.
 * 6. 외부 관측자 인트로가 첫 로드에 «따로» 돈다. 그 컷신은 화면 전체를
 *    불투명도 0.985로 덮으므로(`.oo2-cine`), 안 끄고 재면 무엇을 재도
 *    「덮개가 있다」가 나온다. 사람은 이걸 보거나 건너뛴 «뒤에» 논다 —
 *    `StellaIntroObserver.stop()` 으로 그 상태를 만들고 잰다.
 *
 *   node scripts/probe-overdraw.mjs
 */
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";

const probe = await launchProbe({ windowSize: "1280,900" });
const { evaluate, waitFor, close, errors } = probe;

/* 뷰포트와 겹치는 면적이 40% 이상인 것만 «전면 레이어»로 센다. 그보다 작은
   것은 패널이지 덮개가 아니다. */
const SCAN = `(() => {
  const vw = innerWidth, vh = innerHeight, area = vw * vh;
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    const px = w * h;
    if (px < area * 0.4) continue;
    const promoted =
      cs.transform !== "none" ||
      cs.filter !== "none" ||
      (cs.willChange && cs.willChange !== "auto") ||
      cs.backdropFilter !== "none";
    out.push({
      tag: el.tagName.toLowerCase(),
      id: el.id || "",
      cls: (el.className && el.className.baseVal !== undefined
        ? el.className.baseVal
        : String(el.className || "")).slice(0, 40),
      cover: +(px / area).toFixed(2),
      op: +cs.opacity,
      promoted,
      bg: cs.backgroundImage !== "none" ? "img" : cs.backgroundColor,
      blend: cs.mixBlendMode,
    });
  }
  const painted = out.filter((l) => l.op > 0);
  return JSON.stringify({
    total: out.length,
    painted: painted.length,
    transparent: out.length - painted.length,
    promoted: painted.filter((l) => l.promoted).length,
    coverSum: +painted.reduce((a, l) => a + l.cover, 0).toFixed(2),
    layers: painted,
  });
})()`;

function show(label, raw) {
  const d = JSON.parse(raw);
  console.log(
    `\n── ${label}  칠하는 레이어 ${d.painted}장 (투명 ${d.transparent}) · 승격 ${d.promoted} · 덮는 화면수 ${d.coverSum}`,
  );
  for (const l of d.layers) {
    const name = l.id ? "#" + l.id : l.cls ? "." + l.cls : l.tag;
    console.log(
      `   ${String(l.cover).padStart(4)}화면  op ${String(l.op).padEnd(4)} ${l.promoted ? "승격" : "    "}  ${name.padEnd(28)} ${l.bg} ${l.blend !== "normal" ? l.blend : ""}`,
    );
  }
  return d;
}

try {
  await waitFor("typeof setupBattle === 'function'", 30000);
  /* 관측자 인트로를 끝낸 «놀기 시작하는 자리»에서 잰다 — 함정 6. */
  await evaluate("window.StellaIntroObserver?.stop(), 1");
  await delay(1200);
  const title = show("타이틀", await evaluate(SCAN));

  await evaluate(`(() => {
    const pool = ["gaon","biyeon","ria"];
    stageIndex = stages.findIndex((s) => s.id === "2-2");
    deployed = [...pool]; selected = [...pool];
    resetBuild(); setupBattle();
    return 1;
  })()`);
  /* 시네마가 끝나 판이 열릴 때까지 기다린다 — 함정 5. */
  await waitFor("!battleCine", 12000);
  await delay(600);
  const battle = show("전투 2-2 (판 열린 뒤)", await evaluate(SCAN));

  console.log("\n════ 읽는 법");
  console.log(
    `타이틀 ${title.coverSum}화면분 → 전투 ${battle.coverSum}화면분. 전투에서 줄지`,
  );
  console.log(
    "않으면 판 뒤에 메타 화면의 덮개가 그대로 남아 매 프레임 합성된다는 뜻이다.",
  );
  const stuck = battle.layers.filter((b) =>
    title.layers.some((t) => (t.id || t.cls) === (b.id || b.cls)),
  );
  if (stuck.length)
    console.log(
      "전투에도 남은 것: " +
        stuck.map((s) => s.id || s.cls || s.tag).join(", "),
    );
  if (errors.length) console.log("\n콘솔 오류: " + errors.join(" | "));
} finally {
  close();
}
