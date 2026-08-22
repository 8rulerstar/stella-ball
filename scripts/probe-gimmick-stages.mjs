/**
 * 기믹이 «판에 보이는가». 월드마다 한 판씩 들어가 찍는다.
 *
 * 기믹은 데이터로 켜지지만 그리는 코드가 따로 있다. 데이터가 들어갔다는
 * 것과 화면에 읽힌다는 것은 다른 말이라, 스테이지 객체를 세는 것으로는
 * 끝나지 않는다.
 *
 * 이 프로브가 틀리는 법:
 * 1. 입장 시네마(4.2초)가 판을 덮는다. 판이 열린 뒤에 찍어야 한다.
 * 2. 외부 관측자 인트로를 안 끄면 전부 새까맣다.
 * 3. 조준 화면은 유성이 구르면 꺼진다. 멈춘 상태에서 찍는다.
 *
 *   node scripts/probe-gimmick-stages.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";

const OUT = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "artifacts/gimmicks";
mkdirSync(OUT, { recursive: true });

const PICKS = process.argv.includes("--stages")
  ? process.argv
      .slice(process.argv.indexOf("--stages") + 1)
      .filter((a) => /^\d-\d$/.test(a))
  : ["1-3", "2-2", "3-3", "4-3", "5-4", "6-4", "7-4", "8-1"];

const probe = await launchProbe({ windowSize: "1280,900" });
const { evaluate, waitFor, send, close, errors } = probe;

const LIVE = `JSON.stringify({
  walls: (typeof stageWalls !== "undefined" ? stageWalls : []).length,
  boost: (typeof boostPads !== "undefined" ? boostPads : []).length,
  drag: (typeof dragPads !== "undefined" ? dragPads : []).length,
  adds: (typeof adds !== "undefined" ? adds : []).length,
  orbits: (typeof orbitals !== "undefined" ? orbitals : []).length,
  shield: typeof bossShield !== "undefined" && bossShield ? bossShield.hits : 0,
  phases: typeof stagePhases !== "undefined" && stagePhases ? stagePhases.at.length : 0,
  label: (document.querySelector("#phaseText")?.textContent || "").trim().slice(0, 40),
})`;

try {
  await waitFor("typeof setupBattle === 'function'", 30000);
  await evaluate("window.StellaIntroObserver?.stop(), 1"); // 함정 2
  /* 함정 4 — 새 저장으로 앞쪽 판에 들어가면 이야기 인트로가 겹쳐 판이
     아니라 인트로를 찍는다. 실제로 1-3 스크린샷이 세 번 그렇게 나왔다.
     이미 해 본 저장으로 만들어 둔다. */
  await evaluate(
    "progress.clears = 30, saveProgress(), (typeof onboarding === 'object' && onboarding ? (onboarding.done = true) : 0), 1",
  ).catch(() => {});
  for (const id of PICKS) {
    await evaluate(`(() => {
      const i = stages.findIndex((s) => s.id === ${JSON.stringify(id)});
      if (i < 0) return 0;
      const pool = Object.keys(heroes).slice(0, 3);
      stageIndex = i; deployed = selected = pool;
      resetBuild(); setupBattle();
      return 1;
    })()`).catch(() => {});
    await waitFor("!battleCine", 12000).catch(() => {}); // 함정 1
    /* battleCine 이 풀려도 시네 베일(.cin-veil)이 0.45초 더 걷힌다.
       그 사이에 찍으면 판 전체가 하얗게 씻겨 색을 판단할 수 없다 —
       실제로 첫 스크린샷이 그래서 못 쓰게 나왔다. 상자가 사라질
       때까지 기다린다. */
    await waitFor(
      '!document.querySelector(".cin") || getComputedStyle(document.querySelector(".cin-veil")).opacity < "0.05"',
      8000,
    ).catch(() => {});
    await delay(3000); // 함정 3 — 거상 강하 연출까지 끝나야 판이 보인다
    /* 함정 5 — 관측자 인트로는 «한 번 끄면 끝»이 아니다. 저장을 건드리거나
       화면이 바뀌면 다시 걸려, 판 대신 커다란 눈동자를 찍는다. 실제로 세
       번 그렇게 나왔다. 찍기 직전에 매번 끈다. */
    await evaluate("window.StellaIntroObserver?.stop(), 1").catch(() => {});
    await delay(400);
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${OUT}/${id}.png`, Buffer.from(data, "base64"));
    const d = JSON.parse(await evaluate(LIVE));
    const live = Object.entries(d)
      .filter(([k, v]) => k !== "label" && v)
      .map(([k, v]) => `${k}:${v}`)
      .join(" ");
    console.log(`  ${id}  ${live || "(기믹 없음)"}   「${d.label}」`);
  }
  console.log(
    errors.length ? "\n콘솔 오류: " + errors.join(" | ") : "\n콘솔 오류 없음",
  );
  console.log(`스크린샷 -> ${OUT}/`);
} finally {
  close();
}
