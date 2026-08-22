/**
 * 소환 연출 10초를 비트마다 실기로 본다.
 *
 * 소환은 이 게임에서 가장 긴 단발 연출인데(부름 → 관측 → 응답 → 현현 →
 * 소개, 10초) 프로브가 없었다. 각 비트에서 스크린샷과 화면 문안을 뽑고,
 * 연출이 끝난 뒤 «실제로 별지기가 늘었는지»까지 확인한다.
 *
 * 이 프로브가 틀리는 법:
 * 1. `prefers-reduced-motion: reduce` 가 켜져 있으면 10초짜리가 0.42초로
 *    접힌다(SUMMON.reduced). 크롬을 그냥 띄우면 기계 설정을 따라가므로,
 *    CDP 로 «reduce 아님»을 명시해야 무엇을 재는지 확정된다.
 * 2. 소환할 후보가 없으면 버튼이 잠긴다. 보유 별지기를 기본값으로 되돌려
 *    후보를 확보한 뒤 눌러야 한다.
 * 3. 골드나 무료 소환권이 없으면 버튼이 「골드 부족」으로 잠긴다.
 * 4. 비트 시각은 «버튼을 누른 순간» 기준이다. 화면이 그려지기를 기다리는
 *    시간을 빼지 않으면 뒤로 갈수록 어긋난다 — 한 번만 기준시각을 잡고
 *    그때부터의 절대 시각으로 기다린다.
 *
 *   node scripts/probe-summon.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";

const OUT = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "artifacts/summon";
mkdirSync(OUT, { recursive: true });

/* SUMMON.full 의 비트 + 끝난 뒤 한 장. */
const BEATS = [
  [200, "call", "부름"],
  [2200, "observe", "관측"],
  [5700, "answer", "응답"],
  [7200, "manifest", "현현"],
  [8700, "intro", "소개"],
  [10400, "done", "종료"],
];

const STATE = `(() => {
  const stage = document.querySelector(".summon-stage");
  const reveal = document.querySelector("#gachaReveal");
  const vis = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0.05;
  };
  return JSON.stringify({
    phase: stage ? stage.dataset.phase : "(무대 없음)",
    caption: stage ? (stage.querySelector(".summon-caption")?.textContent || "").trim() : "",
    revealClass: reveal ? reveal.className : "(없음)",
    revealText: reveal ? reveal.textContent.trim().replace(/\\s+/g, " ").slice(0, 46) : "",
    portrait: (() => {
      const p = document.querySelector("#gachaHeroReveal");
      if (!p) return "";
      const bg = getComputedStyle(p).backgroundImage;
      return bg && bg !== "none" ? "있음" : "빈 칸";
    })(),
    drawLabel: (document.querySelector("#gachaDraw")?.textContent || "").trim().slice(0, 24),
    owned: typeof progress !== "undefined" ? progress.ownedHeroes.length : -1,
    skipVisible: vis(document.querySelector(".summon-skip")),
  });
})()`;

const probe = await launchProbe({ windowSize: "1280,900" });
const { evaluate, waitFor, send, close, errors } = probe;

try {
  await waitFor("typeof showGacha === 'function'", 30000);
  /* 함정 1 — 어떤 연출을 재는지 확정한다. */
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  await evaluate("window.StellaIntroObserver?.stop(), 1");
  /* 함정 2·3 — 후보와 지불 수단을 확보한다. */
  await evaluate(`(() => {
    progress.gold = 4000;
    progress.freeSummons = 0;
    progress.ownedHeroes = [...STARTER_HERO_IDS];
    saveProgress();
    showGacha();
    return 1;
  })()`);
  /* 고정 대기로는 가끔 버튼이 아직 없다 — 실제로 한 번 null 을 눌렀다. */
  await waitFor("!!document.querySelector('#gachaDraw')", 10000);
  await delay(600);
  const before = JSON.parse(await evaluate(STATE));
  console.log(
    `소환 전 — 보유 별지기 ${before.owned}명 · 버튼 「${before.drawLabel}」`,
  );

  await evaluate("document.querySelector('#gachaDraw').click(), 1");
  const t0 = Date.now(); // 함정 4

  for (const [ms, key, label] of BEATS) {
    const wait = ms - (Date.now() - t0);
    if (wait > 0) await delay(wait);
    const d = JSON.parse(await evaluate(STATE));
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${OUT}/${key}.png`, Buffer.from(data, "base64"));
    console.log(
      `\n${String(ms).padStart(5)}ms ${label.padEnd(3)} 단계 ${String(d.phase).padEnd(9)} 자막 「${d.caption}」`,
    );
    console.log(
      `        초상 ${d.portrait || "(없음)"} · 건너뛰기 ${d.skipVisible ? "보임" : "없음"} · ${d.revealText || "(빈 칸)"}`,
    );
  }

  const after = JSON.parse(await evaluate(STATE));
  console.log(
    `\n소환 후 — 보유 별지기 ${after.owned}명 (${after.owned - before.owned > 0 ? "늘었다" : "안 늘었다 ✗"}) · 버튼 「${after.drawLabel}」`,
  );
  const gold = await evaluate("goldBalance()");
  console.log(`        남은 골드 ${gold} (4000에서 소환값만큼 빠져야 한다)`);
  if (errors.length) console.log("\n콘솔 오류: " + errors.join(" | "));
  console.log(`\n스크린샷 -> ${OUT}/`);
} finally {
  close();
}
